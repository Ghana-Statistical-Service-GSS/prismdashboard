"use client";

import clsx from "clsx";
import { ppiKeys } from "../api";
import { usePpiQuery } from "../usePpiQuery";
import type { Breakdown, Completeness, GroupRow, Overview } from "./types";
import { age, count, dateTime, ENTITY_LABEL, QUESTIONNAIRE_SHORT, SECTION_LABEL, SERIES_LABEL, SYNC } from "./format";
import { Notice, Panel, Pill, RatioBar } from "./ui";

const ORDER = ["AGRICULTURE", "CONSTRUCTION", "OTHER", "WHOLESALE_RETAIL"];

// What each questionnaire asks, measured on the server copies (submitted
// versions and work in progress as last synced) against the round's rules.
export function QuestionnaireCompleteness({ overview }: { overview: Overview }) {
  const rows = overview.completeness ?? [];
  return (
    <Panel
      id="ppi-completeness"
      title="Questionnaire completeness"
      hint="Started interviews held on the server, against what each questionnaire requires. History months up to the fieldwork start need a price; later months take a price or “not available”. Work not yet synced from phones is not included."
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {ORDER.map((qt) => {
          const c = rows.find((r) => r.questionnaireType === qt);
          return <QuestionnaireCard key={qt} qt={qt} c={c} />;
        })}
      </div>
      <p className="mt-3 text-[11px] text-prism-muted">Category names are the respondents’ own words and are not compared across establishments. Revenue amounts are never added up: establishments report in different currencies.</p>
    </Panel>
  );
}

function QuestionnaireCard({ qt, c }: { qt: string; c: Completeness | undefined }) {
  return (
    <article className="rounded-2xl border border-prism-border/70 p-4">
      <h3 className="text-sm font-black text-prism-text">{QUESTIONNAIRE_SHORT[qt]}</h3>
      {!c ? <p className="mt-2 text-xs text-prism-muted">No establishments of this type in this view.</p> : (
        <>
          <p className="mt-1 text-[11px] text-prism-muted">{count(c.assigned)} assigned · {count(c.started)} started · {count(c.submitted)} submitted{c.measured < c.started ? ` · ${count(c.started - c.measured)} still being measured` : ""}</p>
          {!c.started ? <p className="mt-3 text-xs text-prism-muted">No interview started yet.</p> : (
            <div className="mt-3 space-y-2.5">
              <RatioBar label="Major product categories entered" {...c.categoriesEntered} note={`${count(c.categories)} categories in total`} />
              <RatioBar label="Products entered against declared counts" {...c.productsAgainstDeclared} />
              <RatioBar label="Products with complete specifications" {...c.productsSpecified} />
              {c.series.map((s) => (
                <div key={s.series} className="space-y-2.5">
                  <RatioBar label={`${SERIES_LABEL[s.series]}: current prices`} {...s.current} />
                  <RatioBar label={`${SERIES_LABEL[s.series]}: history up to fieldwork`} {...s.historyDue} />
                </div>
              ))}
              <RatioBar label="Later months answered (price or not available)" {...c.historyLate} />
              {c.seasonality && <RatioBar label="Product seasonality" {...c.seasonality} />}
              {c.quantitySold && <RatioBar label="Quantity sold" {...c.quantitySold} />}
              {c.saleFrequency && <RatioBar label="Sale frequency" {...c.saleFrequency} />}
              {c.contractDetails && <RatioBar label="Contract details" {...c.contractDetails} />}
              {c.quarterlyRevenue && <RatioBar label="Quarterly revenue" {...c.quarterlyRevenue} />}
              <p className="text-[11px] text-prism-muted">
                Revenue reconciliation: <strong className="text-emerald-700">{count(c.revenue.match)} match</strong>
                {" · "}<strong className={c.revenue.mismatch ? "text-rose-700" : "text-prism-text"}>{count(c.revenue.mismatch)} do not match</strong>
                {" · "}{count(c.revenue.incomplete)} not yet checkable
              </p>
              {c.draftSpecifications > 0 && <p className="text-[11px] text-amber-800">{count(c.draftSpecifications)} draft specification(s) not counted.</p>}
            </div>
          )}
        </>
      )}
    </article>
  );
}

// Returns, repeat cycles and data checks.
export function CorrectionsAndQuality({ overview }: { overview: Overview }) {
  const c = overview.corrections!;
  const q = overview.quality!;
  const [a, b, d] = overview.thresholds.correctionAgeBandsDays;
  const sections = Object.entries(q.outstandingBySection).sort((x, y) => y[1] - x[1]);
  return (
    <Panel id="ppi-quality" title="Corrections and data quality" hint="Returned work and the checks the questionnaire rules apply. A flagged value is not automatically wrong; it needs inspection.">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Returned for correction</h3>
          <p className="mt-1 text-sm"><span className="text-2xl font-black text-prism-text">{count(c.returned)}</span> <span className="text-xs text-prism-muted">not yet resubmitted{c.returned ? ` · oldest ${age(c.oldestDays)}` : ""}</span></p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
            {[`under ${a} day`, `${a}–${b} days`, `${b}–${d} days`, `${d}+ days`].map((label, i) => <li key={label} className="text-prism-muted">{label}: <strong className="text-prism-text">{c.bands[i]}</strong></li>)}
          </ul>
          <h4 className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Correction cycles</h4>
          <p className="mt-1 text-[11px] text-prism-muted">
            {count(c.everReturned)} establishment(s) returned at least once: {count(c.cycles.once)} once, {count(c.cycles.twice)} twice, <strong className={c.cycles.threePlus ? "text-rose-700" : "text-prism-text"}>{count(c.cycles.threePlus)} three times or more</strong>. {count(c.approvedAfterReturn)} approved after a return.
          </p>
          <h4 className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-prism-muted">What reviewers flagged</h4>
          {c.commentsByRecordType.length ? (
            <ul className="mt-1 space-y-1 text-[11px]">
              {c.commentsByRecordType.map((t) => (
                <li key={t.entityType} className="flex justify-between gap-2"><span>{ENTITY_LABEL[t.entityType] ?? t.entityType}</span><span className="tabular-nums text-prism-muted"><strong className="text-prism-text">{count(t.comments)}</strong> comment(s) in {count(t.returns)} return(s)</span></li>
              ))}
            </ul>
          ) : <p className="mt-1 text-[11px] text-prism-muted">No record-level comments yet.</p>}
          <p className="mt-1 text-[11px] text-prism-muted">{count(c.returnsWithoutComments)} return(s) without record-level comments. Return reasons are free text and are not grouped.</p>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Work in progress on the server ({count(q.working)})</h3>
          <p className="mt-1 text-[11px] text-prism-muted">In progress or returned, as last synced{q.workingMeasured < q.working ? `; ${count(q.working - q.workingMeasured)} still being measured` : ""}.</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <Check label="With outstanding required information" value={q.withOutstanding} hint={`${count(q.outstandingItems)} items`} />
            <Check label="Revenue does not reconcile with categories" value={q.revenueMismatch} />
            <Check label="GPS too far from the preloaded location" value={q.gps.tooFar} />
            <Check label="GPS accuracy not good enough" value={q.gps.lowAccuracy} />
            <Check label="Location captured but not yet verified" value={q.gps.unverified} />
            <Check label="Location not yet captured" value={q.gps.notCaptured} muted />
            <Check label="No preloaded location (cannot be verified)" value={q.gps.noReference} hint="all assigned, not approved" />
            <Check label="Captured away from the firm, reason given" value={q.gps.awayWithReason ?? 0} hint="including submitted, not approved" />
            <Check label="Prices in another currency" value={q.currencyMismatch} />
            <Check label="Current price differs from its history month" value={q.priceMonthMismatch} hint="warning only, including submitted" warning />
          </ul>
          {sections.length > 0 && (
            <p className="mt-3 text-[11px] text-prism-muted">Outstanding by section: {sections.map(([k, v]) => `${SECTION_LABEL[k] ?? k} ${v}`).join(" · ")}</p>
          )}
          <p className="mt-3 rounded-xl bg-prism-bg/70 px-3 py-2 text-[11px] text-prism-muted">Price exceptions: no price-range or price-change rule is configured for PPI, so no prices are flagged here.</p>
        </div>
      </div>
    </Panel>
  );
}

// warning: a check that never blocks submission (amber, not rose).
function Check({ label, value, hint, muted, warning }: { label: string; value: number; hint?: string; muted?: boolean; warning?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-prism-text">{label}{hint ? <span className="text-[10px] text-prism-muted"> · {hint}</span> : null}</span>
      <span className={clsx("min-w-8 rounded-full px-2 py-0.5 text-center text-[11px] font-black",
        !value || muted ? "bg-prism-bg text-prism-text" : warning ? "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300" : "bg-rose-100 text-rose-800")}>{count(value)}</span>
    </li>
  );
}

// Sync follow-up and freshness. Only what reached the server is known.
export function SyncAndFreshness({ overview, userId, query, canListReaders }: { overview: Overview; userId: string; query: string; canListReaders: boolean }) {
  const s = overview.sync!;
  const f = overview.freshness!;
  const params = new URLSearchParams(query);
  params.set("level", "reader");
  params.set("syncFollowUp", "1");
  params.set("pageSize", "10");
  // Every row here needs follow-up: the readers holding the most open work first.
  params.set("sort", "openWork");
  params.set("dir", "desc");
  const list = usePpiQuery<Breakdown<GroupRow>>(canListReaders ? ppiKeys.dashboard("breakdown", userId, params.toString()) : null, canListReaders ? `/breakdown?${params}` : null);
  const states = [
    { key: "CURRENT" as const, value: s.current },
    { key: "INACTIVE" as const, value: s.inactive },
    { key: "STALE" as const, value: s.stale },
    { key: "NEVER" as const, value: s.never },
  ];
  return (
    <Panel id="ppi-sync" title="Sync and data freshness" hint={`What the server last heard from each reader's phone. Stale = not heard from for ${overview.thresholds.syncStaleDays}+ days; work saved on a phone but not uploaded is not visible here.`}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {states.map((st) => (
          <li key={st.key} className="rounded-2xl bg-prism-bg/70 px-3 py-2" title={SYNC[st.key].hint}>
            <Pill className={SYNC[st.key].style}>{SYNC[st.key].label}</Pill>
            <p className="mt-1 text-lg font-black text-prism-text">{count(st.value)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-prism-muted">
        {count(s.readers)} reader(s) · {count(s.staleWithOpenWork)} stale with work still open · {count(s.refused)} with refusals in their latest upload · {count(s.followUp)} need follow-up
      </p>
      {canListReaders && (
        <div className="mt-3">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Readers to follow up</h3>
          {list.error && <Notice tone="error">{list.error}</Notice>}
          <ul className="mt-1 divide-y divide-prism-border/60 text-[11px]">
            {(list.data?.rows ?? []).map((r) => r.sync && (
              <li key={r.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="font-bold text-prism-text">{r.name}</span>
                  <span className="text-prism-muted"> · {r.regionNames} · {count(r.sync.openWork)} open</span>
                  <span className="block text-prism-muted">Last download {dateTime(r.sync.lastDownloadAt)} · last change received {dateTime(r.sync.lastChangeAt)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap gap-1">
                  <Pill className={SYNC[r.sync.state].style}>{SYNC[r.sync.state].label}</Pill>
                  {r.sync.lastUploadRefused > 0 && <Pill className="bg-rose-100 text-rose-800">{r.sync.lastUploadRefused} refused · {r.sync.lastRefusalCode}</Pill>}
                </span>
              </li>
            ))}
            {list.data && !list.data.rows.length && <li className="py-3 text-prism-muted">No reader needs sync follow-up.</li>}
          </ul>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-1 gap-1 rounded-2xl border border-prism-border/70 px-3 py-2 text-[11px] sm:grid-cols-2">
        <div><dt className="inline text-prism-muted">Figures calculated </dt><dd className="inline font-bold text-prism-text">{dateTime(f.generatedAt)}</dd></div>
        <div><dt className="inline text-prism-muted">Last submission received </dt><dd className="inline font-bold text-prism-text">{dateTime(f.lastSubmittedAt)}</dd></div>
        <div><dt className="inline text-prism-muted">Last upload received </dt><dd className="inline font-bold text-prism-text">{dateTime(f.lastUploadAt)}</dd></div>
        <div><dt className="inline text-prism-muted">Completeness pending recalculation </dt><dd className="inline font-bold text-prism-text">{count(f.progressPending)}{f.refreshSkipped && f.progressPending > 0 ? " (being recalculated)" : ""}</dd></div>
      </dl>
    </Panel>
  );
}

