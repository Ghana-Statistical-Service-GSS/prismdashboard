"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { ppiKeys } from "../api";
import { invalidatePpi, usePpiQuery } from "../usePpiQuery";
import type { Breakdown, GroupLevel, GroupRow, Option, Overview, Stage, ViewLevel } from "./types";
import { dateTime, LEVEL_LABEL, MODE_LABEL, QUESTIONNAIRE_SHORT } from "./format";
import { HeadlineCards, WorkflowStrip } from "./Headline";
import { Comparison, type Metric, type SortChoice } from "./Comparison";
import { EstablishmentDetail, EstablishmentList } from "./Establishments";
import { CollectionActivity, NeedsAttention, ReviewBottlenecks } from "./Monitoring";
import { CorrectionsAndQuality, QuestionnaireCompleteness, SyncAndFreshness } from "./Quality";
import { SelfCompletionPanel } from "./SelfCompletion";
import { focusRing, LabelledSelect, Notice, PageLink, Segmented } from "./ui";
import { apiQuery, type DashboardState, type StatePatch, useDashboardState } from "./useDashboardState";

// The levels each role may group by (the server enforces the same list).
const LEVELS_BY_ROLE: Record<DashboardUser["role"], ViewLevel[]> = {
  HQ: ["region", "district", "supervisor", "reader", "establishment"],
  ADMIN: ["region", "district", "supervisor", "reader", "establishment"],
  REGIONAL_STATISTICIAN: ["district", "supervisor", "reader", "establishment"],
  SUPERVISOR: ["reader", "establishment"],
};
const HIDDEN_FILTERS: Record<DashboardUser["role"], Partial<DashboardState>> = {
  HQ: {},
  ADMIN: {},
  REGIONAL_STATISTICIAN: { regionId: null },
  SUPERVISOR: { regionId: null, districtId: null, supervisorId: null },
};
const MY_STAGE: Record<DashboardUser["role"], Stage> = { SUPERVISOR: "SUPERVISOR", REGIONAL_STATISTICIAN: "RS", HQ: "HQ", ADMIN: "HQ" };
// Region > supervisor > reader > establishment; a district opens its supervisors.
const NEXT: Record<GroupLevel, ViewLevel> = { region: "supervisor", district: "supervisor", supervisor: "reader", reader: "establishment" };
const STALE_AFTER_MS = 5 * 60_000;
const NONE = "none";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// The view a filter change lands on: selecting a region (or district,
// supervisor, reader) moves the comparison one level below it.
function viewAfter(state: DashboardState, patch: StatePatch, current: ViewLevel, allowed: ViewLevel[]): ViewLevel {
  const next = { ...state, ...patch };
  let view = current;
  if (next.regionId && view === "region") view = "supervisor";
  if (next.districtId && (view === "region" || view === "district")) view = "supervisor";
  if (next.supervisorId && ["region", "district", "supervisor"].includes(view)) view = "reader";
  if (next.enumeratorId && view !== "establishment") view = "establishment";
  return allowed.includes(view) ? view : allowed[allowed.length - 1];
}

export function PpiDashboard() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [userError, setUserError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { state: address, href, update } = useDashboardState();
  // Whether the open establishment was opened from this page (Back can then
  // return to the list; a deep link has no such entry to go back to).
  const openedHere = useRef(false);

  useEffect(() => {
    let active = true;
    loadDashboardUser().then((u) => { if (active) setUser(u); }).catch(() => { if (active) setUserError("Your session could not be loaded. Sign in again."); });
    return () => { active = false; };
  }, []);
  // A clock for the "figures may be out of date" notice.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Filters above the role's own scope are dropped (an edited address shows
  // the normal view; the server ignores them anyway by AND-ing with scope).
  const state: DashboardState = user ? { ...address, ...HIDDEN_FILTERS[user.role] } : address;
  const allowed = user ? LEVELS_BY_ROLE[user.role] : [];
  const requested = allowed.includes(state.view as ViewLevel) ? (state.view as ViewLevel) : null;
  // The overview depends on the filters only (the same query every panel
  // sends); comparison rows at any other level than the scope's starting
  // one come from /breakdown, so changing "Compare by" never re-runs it.
  const filterQuery = apiQuery(state);
  const overview = usePpiQuery<Overview>(user ? ppiKeys.dashboard("overview", user.user_id, filterQuery) : null, user ? `/overview?${filterQuery}` : null);
  const o = overview.data;
  const view: ViewLevel | null = requested ?? o?.scope.primaryLevel ?? null;
  const groupsLevel = o?.round && view && view !== "establishment" && view !== o.scope.primaryLevel ? view : null;
  const groupsParams = groupsLevel ? apiQuery(state, { level: groupsLevel, pageSize: "1000" }) : null;
  const groupsQuery = usePpiQuery<Breakdown<GroupRow>>(
    user && groupsParams ? ppiKeys.dashboard("breakdown", user.user_id, groupsParams) : null,
    groupsParams ? `/breakdown?${groupsParams}` : null,
  );

  if (userError) return <Notice tone="error">{userError}</Notice>;
  if (!user || (!o && !overview.error)) return <Header user={user} overview={null} onRefresh={() => {}} stale={false} loading />;
  if (!o) {
    return (
      <>
        <Header user={user} overview={null} onRefresh={() => invalidatePpi("ppi:dashboard")} stale={false} loading={false} />
        <div className="mt-6"><Notice tone="error">{overview.error}</Notice></div>
      </>
    );
  }

  const currentView: ViewLevel = view ?? o.scope.primaryLevel;
  const stale = now - new Date(o.generatedAt).getTime() > STALE_AFTER_MS;
  // A page load sends several requests at once and only one recomputes; the
  // others report the rows it is still working on (refreshSkipped). Say
  // "being recalculated" only when this request did the work and rows are
  // left, or more is pending than one request recomputes.
  const f = o.freshness;
  const recalculating = !!f && f.progressPending > 0 && (!f.refreshSkipped || f.progressPending > f.refreshLimit);
  const refresh = () => invalidatePpi("ppi:dashboard");
  const canListReaders = o.scope.levels.includes("reader");
  const options = o.filters.options;
  const from = state.from ?? daysAgo(29);
  const to = state.to ?? today();

  const go = (patch: StatePatch) => update({ initiationId: null, page: null, attentionPage: null, ...patch }, { push: true });
  const setFilter = (patch: StatePatch) => go({ ...patch, status: null, view: viewAfter(state, patch, currentView, o.scope.levels) });
  const openEstablishment = (initiationId: string) => {
    openedHere.current = true;
    go({ initiationId });
  };
  // Back to the list it was opened from; a deep link has no entry to go
  // back to, so it lands on the establishment list of the current filters.
  const closeEstablishment = () => {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else {
      update({ initiationId: null, view: "establishment" }, { push: true });
    }
  };
  // Filter ids that are not among the scope's choices (pasted from another
  // user's address, or no longer assigned): the server shows nothing for
  // them, so say so instead of showing silent zeros.
  const outside = options ? ([
    ["region", state.regionId, options.regions],
    ["district", state.districtId, options.districts],
    ["supervisor", state.supervisorId, options.supervisors],
    ["reader", state.enumeratorId, options.readers],
  ] as const).filter(([, id, list]) => id && !list.some((option) => option.id === id)).map(([label]) => label) : [];
  const clearFilters = () => go({ regionId: null, districtId: null, supervisorId: null, enumeratorId: null, view: null, status: null });
  const openGroup = (level: GroupLevel) => (row: GroupRow) => {
    const key = row.key ?? NONE;
    const patch: StatePatch = level === "region" ? { regionId: key } : level === "district" ? { districtId: key } : level === "supervisor" ? { supervisorId: key } : { enumeratorId: key };
    go({ ...patch, view: NEXT[level], status: null });
  };

  if (!o.round) {
    return (
      <>
        <Header user={user} overview={o} onRefresh={refresh} stale={false} loading={false} />
        <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="text-base font-black text-prism-text">PPI initiation is not set up</p>
          <p className="mt-1 text-sm text-prism-muted">The PPI initiation has not been set up on the server yet. Figures appear here once it is, and HQ has assigned establishments.</p>
        </div>
      </>
    );
  }

  const stages = o.round.reviewStages;
  // Rows are drawn and drilled at the level their response was computed for
  // (while another level loads, the previous rows stay, with their level).
  const shown = groupsLevel ? groupsQuery.data : o.groups;
  const groupRows = (shown?.rows ?? []) as GroupRow[];
  const rowsLevel = (shown?.level && shown.level !== "establishment" ? shown.level : currentView) as GroupLevel;
  const groupLevels = o.scope.levels;
  const csv = (extra: Record<string, string | null>) => `/api/dashboard/ppi/export?${apiQuery(state, extra)}`;

  return (
    <>
      <Header user={user} overview={o} onRefresh={refresh} stale={stale} loading={overview.loading} />

      <FilterBar
        overview={o}
        state={state}
        options={options}
        onFilter={setFilter}
        href={href}
      />

      {stale && <div className="mt-4"><Notice tone="warn">These figures were calculated at {dateTime(o.generatedAt)}. <button type="button" onClick={refresh} className={clsx("font-bold underline", focusRing)}>Refresh</button> to see the latest.</Notice></div>}
      {recalculating && <div className="mt-4"><Notice tone="warn">Completeness for {o.freshness!.progressPending} establishment(s) is being recalculated; their completeness figures are as last calculated. {o.freshness!.refreshFailures > 0 ? `${o.freshness!.refreshFailures} could not be recalculated and will stay as last calculated until that is fixed - tell the system administrator.` : "Refresh in a moment."}</Notice></div>}
      {outside.length > 0 ? (
        <div className="mt-4">
          <Notice tone="warn">
            The {outside.join(" and ")} in this address {outside.length === 1 ? "is" : "are"} outside your scope or {outside.length === 1 ? "has" : "have"} no assignment, so nothing is shown.{" "}
            <button type="button" onClick={clearFilters} className={clsx("font-bold underline", focusRing)}>Clear filters</button>
          </Notice>
        </div>
      ) : o.headline && o.headline.assigned === 0 && <div className="mt-4"><Notice>No establishment is assigned in this view: percentages are shown as n/a.</Notice></div>}

      <div className={clsx("mt-6 space-y-6 transition-opacity", overview.loading && "opacity-70")}>
        {o.headline && <HeadlineCards overview={o} href={href} canListReaders={canListReaders} userId={user.user_id} query={filterQuery} />}

        {groupsQuery.error && <Notice tone="error">{groupsQuery.error}</Notice>}
        {state.initiationId ? (
          <EstablishmentDetail userId={user.user_id} initiationId={state.initiationId} onBack={closeEstablishment} />
        ) : currentView === "establishment" ? (
          <EstablishmentList
            userId={user.user_id}
            query={filterQuery}
            status={state.status ?? ""}
            search={state.search ?? ""}
            page={Number(state.page) || 1}
            regionId={state.regionId}
            regions={o.scope.level === "NATIONAL" ? options?.regions ?? [] : null}
            onStatus={(status) => update({ status: status || null, page: null })}
            onSearch={(search) => update({ search: search || null, page: null })}
            onPage={(page) => update({ page: page > 1 ? String(page) : null })}
            onRegion={(regionId) => go({ regionId, districtId: null, supervisorId: null, enumeratorId: null })}
            onOpen={(row) => row.initiationId && openEstablishment(row.initiationId)}
            onMoreFilters={() => {
              const panel = document.getElementById("ppi-filters");
              panel?.scrollIntoView({ behavior: "smooth", block: "start" });
              panel?.querySelector<HTMLElement>("select, button")?.focus({ preventScroll: true });
            }}
            csvHref={csv({ dataset: "breakdown", level: "establishment", status: state.status, search: state.search })}
          />
        ) : (
          <Comparison
            level={rowsLevel}
            rows={groupRows}
            stages={stages}
            metric={(state.metric as Metric) || "submitted"}
            sort={(state.sort as SortChoice) || "count"}
            onMetric={(metric) => update({ metric })}
            onSort={(sort) => update({ sort })}
            // Drilling waits until the rows are those of the level shown.
            onOpen={rowsLevel === currentView ? openGroup(rowsLevel) : null}
            nextLabel={LEVEL_LABEL[NEXT[rowsLevel]].many.toLowerCase()}
            csvHref={csv({ dataset: "breakdown", level: rowsLevel })}
            loading={overview.loading || groupsQuery.loading || rowsLevel !== currentView}
            groupBy={
              <Segmented
                label="Compare by"
                showLabel
                value={currentView}
                options={groupLevels.map((l) => ({ value: l, label: LEVEL_LABEL[l].many }))}
                onChange={(level) => go({ view: level, status: null })}
              />
            }
          />
        )}

        {o.headline && <WorkflowStrip overview={o} href={href} decidesRemovals={user.role === "HQ" || user.role === "ADMIN"} />}

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ReviewBottlenecks overview={o} myStage={MY_STAGE[user.role]} />
          <NeedsAttention
            userId={user.user_id}
            query={filterQuery}
            kind={state.kind ?? ""}
            page={Number(state.attentionPage) || 1}
            onKind={(kind) => update({ kind: kind || null, attentionPage: null })}
            onPage={(page) => update({ attentionPage: String(page) })}
            onOpenEstablishment={openEstablishment}
            csvHref={csv({ dataset: "attention", kind: state.kind })}
          />
        </div>

        <CollectionActivity userId={user.user_id} query={filterQuery} from={from} to={to} onRange={(f, t) => update({ from: f, to: t })} />

        <SelfCompletionPanel overview={o} href={href} />

        <QuestionnaireCompleteness overview={o} />

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <CorrectionsAndQuality overview={o} />
          <SyncAndFreshness overview={o} userId={user.user_id} query={filterQuery} canListReaders={canListReaders} />
        </div>
      </div>
    </>
  );
}

function Header({ user, overview, onRefresh, stale, loading }: { user: DashboardUser | null; overview: Overview | null; onRefresh: () => void; stale: boolean; loading: boolean }) {
  const scope = overview?.scope;
  const text = !scope ? "Submissions, coverage, review and corrections for PPI initiation."
    : scope.level === "NATIONAL" ? "National PPI initiation: regional submissions and coverage, review stages and where to intervene."
      : scope.level === "REGION" ? `PPI initiation in ${scope.regionName || "your region"}: coverage by district and supervisor, readers, bottlenecks and data completeness.`
        : scope.level === "SUPERVISED" ? "Your team: progress of your readers and establishments, the review queue and corrections to follow up."
          : "Your establishments: what remains, what you submitted, what was returned and your sync status.";
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">PPI initiation{overview?.round ? ` · ${overview.round.label}` : ""}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:text-3xl md:text-4xl">PPI Initiation Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-prism-muted">{text}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-prism-muted">
        {overview && <span aria-live="polite">{loading ? "Updating…" : `Updated ${dateTime(overview.generatedAt)}`}{stale ? " (out of date)" : ""}</span>}
        {user && overview && (
          <button type="button" onClick={onRefresh} className={clsx("inline-flex min-h-11 items-center gap-2 rounded-xl border border-prism-text bg-white px-5 text-sm font-bold text-prism-text hover:bg-prism-bg", focusRing)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>
            Refresh
          </button>
        )}
      </div>
      {!overview && loading && <span className="sr-only">Loading PPI figures…</span>}
    </section>
  );
}

function FilterBar({ overview, state, options, onFilter, href }: {
  overview: Overview;
  state: DashboardState;
  options: Overview["filters"]["options"];
  onFilter: (patch: StatePatch) => void;
  href: (patch: StatePatch) => string;
}) {
  const [open, setOpen] = useState(false);
  const scope = overview.scope;
  const name = (list: Option[] | undefined, id: string | null, fallback: string) => (id === NONE ? fallback : list?.find((o) => o.id === id)?.name ?? "Outside your scope");
  const regions = options?.regions ?? [];
  const districts = (options?.districts ?? []).filter((d) => !state.regionId || d.regionId === state.regionId || (state.regionId === NONE && !d.regionId));
  const supervisors = (options?.supervisors ?? []).filter((s) => !state.regionId || s.regionIds?.includes(state.regionId));
  const readers = (options?.readers ?? []).filter((r) => (!state.regionId || r.regionIds?.includes(state.regionId)) && (!state.supervisorId || r.supervisorIds?.includes(state.supervisorId)));
  const showRegion = scope.level === "NATIONAL";
  const showDistrict = scope.level === "NATIONAL" || scope.level === "REGION";
  const showSupervisor = showDistrict;
  const showReader = scope.level !== "READER";
  const root = scope.level === "NATIONAL" ? "All regions" : scope.level === "REGION" ? scope.regionName || "My region" : scope.level === "SUPERVISED" ? "My readers" : "My establishments";
  const clearDrill: StatePatch = { regionId: null, districtId: null, supervisorId: null, enumeratorId: null, initiationId: null, view: null, status: null, page: null };

  // Breadcrumbs: the drill path, each step returning to its comparison.
  const crumbs: { label: string; href: string }[] = [{ label: root, href: href(clearDrill) }];
  if (showRegion && state.regionId) crumbs.push({ label: name(regions, state.regionId, "No region recorded"), href: href({ ...clearDrill, regionId: state.regionId, view: "supervisor" }) });
  if (showDistrict && state.districtId) crumbs.push({ label: name(options?.districts, state.districtId, "No district recorded"), href: href({ ...clearDrill, regionId: state.regionId, districtId: state.districtId, view: "supervisor" }) });
  if (showSupervisor && state.supervisorId) crumbs.push({ label: name(options?.supervisors, state.supervisorId, "No supervisor"), href: href({ ...clearDrill, regionId: state.regionId, districtId: state.districtId, supervisorId: state.supervisorId, view: "reader" }) });
  if (showReader && state.enumeratorId) crumbs.push({ label: name(options?.readers, state.enumeratorId, "Reader"), href: href({ ...clearDrill, regionId: state.regionId, districtId: state.districtId, supervisorId: state.supervisorId, enumeratorId: state.enumeratorId, view: "establishment" }) });
  if (state.initiationId) crumbs.push({ label: "Establishment", href: "" });

  const active = [state.regionId, state.districtId, state.supervisorId, state.enumeratorId, state.questionnaireType, state.mode].filter(Boolean).length;
  return (
    <section id="ppi-filters" aria-label="Filters" className="mt-6 scroll-mt-4 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      {/* Phones: the filters fold away behind one button. */}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="ppi-filter-fields"
        className={clsx("flex min-h-10 w-full items-center justify-between rounded-xl bg-prism-bg px-3 text-xs font-bold text-prism-text sm:hidden", focusRing)}>
        <span>{overview.round?.label} · Filters{active ? ` (${active} active)` : ""}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div id="ppi-filter-fields" className={clsx("grid-cols-1 gap-3 sm:flex sm:flex-wrap", open ? "mt-3 grid" : "hidden")}>
        {showRegion && (
          <LabelledSelect label="Region" value={state.regionId ?? ""} onChange={(v) => onFilter({ regionId: v || null, districtId: null, supervisorId: null, enumeratorId: null })} className="sm:min-w-52 sm:max-w-xs">
              <option value="">All</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </LabelledSelect>
        )}
        {showDistrict && (
          <LabelledSelect label="District" value={state.districtId ?? ""} onChange={(v) => onFilter({ districtId: v || null })} className="sm:min-w-52 sm:max-w-xs">
              <option value="">All</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </LabelledSelect>
        )}
        {showSupervisor && (
          <LabelledSelect label="Supervisor" value={state.supervisorId ?? ""} onChange={(v) => onFilter({ supervisorId: v || null, enumeratorId: null })} className="sm:min-w-52 sm:max-w-xs">
              <option value="">All</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </LabelledSelect>
        )}
        {showReader && (
          <LabelledSelect label="Reader" value={state.enumeratorId ?? ""} onChange={(v) => onFilter({ enumeratorId: v || null })} className="sm:min-w-52 sm:max-w-xs">
              <option value="">All</option>
              {readers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </LabelledSelect>
        )}
        <LabelledSelect label="Questionnaire" value={state.questionnaireType ?? ""} onChange={(v) => onFilter({ questionnaireType: v || null })} className="sm:min-w-52 sm:max-w-xs">
            <option value="">All</option>
            {(options?.questionnaireTypes ?? []).map((qt) => <option key={qt} value={qt}>{QUESTIONNAIRE_SHORT[qt] ?? qt}</option>)}
        </LabelledSelect>
        <LabelledSelect label="Completed by" value={state.mode ?? ""} onChange={(v) => onFilter({ mode: v || null })} className="sm:min-w-52 sm:max-w-xs">
            <option value="">Firm or enumerator</option>
            <option value="SELF">{MODE_LABEL.SELF}</option>
            <option value="ENUMERATOR">{MODE_LABEL.ENUMERATOR}</option>
        </LabelledSelect>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-prism-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1 text-xs">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true" className="text-prism-muted">›</span>}
                {i < crumbs.length - 1 ? (
                  <PageLink href={c.href} className={clsx("rounded-full px-2 py-1 font-bold text-prism-purple hover:bg-prism-bg", focusRing)}>{c.label}</PageLink>
                ) : (
                  <span aria-current="page" className="rounded-full bg-prism-bg px-2 py-1 font-black text-prism-text">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <p className="text-[11px] text-prism-muted">
          Showing the current status{state.questionnaireType ? ` · ${QUESTIONNAIRE_SHORT[state.questionnaireType]} only` : ""}{state.mode === "SELF" || state.mode === "ENUMERATOR" ? ` · ${MODE_LABEL[state.mode].toLowerCase()} only` : ""}. Filters apply to every panel; the activity period changes only Collection activity.
        </p>
      </div>
    </section>
  );
}
