"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { formatDateTime, ppiKeys, QUESTIONNAIRE_LABEL, STAGE_LABEL, type QueueFilterOptions, type QueueItem } from "./api";
import { usePpiQuery } from "./usePpiQuery";
import { TableSearch } from "@/components/common/TableSearch";

const STATUSES = [
  { value: "SUBMITTED", label: "Waiting for review" },
  { value: "RETURNED", label: "Returned" },
  { value: "APPROVED", label: "Approved" },
  { value: "ALL", label: "All" },
] as const;

const STATUS_STYLE: Record<QueueItem["workflowStatus"], string> = {
  SUBMITTED: "bg-sky-100 text-sky-800",
  RETURNED: "bg-rose-100 text-rose-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-slate-100 text-prism-muted",
};

type Filters = { regionId: string; districtId: string; supervisorId: string; readerId: string };
const NO_FILTERS: Filters = { regionId: "", districtId: "", supervisorId: "", readerId: "" };
const NONE = "none";

// PPI initiations in the reviewer's scope (the backend applies the scope:
// a Supervisor sees the establishments they supervise, an RS their region,
// HQ everything). The filters narrow it further, never beyond it.
export function ReviewQueue() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("SUBMITTED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState(false);
  const options = usePpiQuery<QueueFilterOptions>(ppiKeys.queueFilters(), "/review-queue/filters");
  const chosen = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const params = new URLSearchParams({ status, page: String(page), pageSize: "25", ...(search.trim() ? { search: search.trim() } : {}), ...chosen }).toString();
  const queue = usePpiQuery<{ total: number; page: number; pageSize: number; items: QueueItem[] }>(ppiKeys.queue(params), `/review-queue?${params}`);
  const items = queue.data?.items ?? [];
  const pages = queue.data ? Math.max(1, Math.ceil(queue.data.total / queue.data.pageSize)) : 1;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-purple">PPI initiation</p>
          <h1 className="mt-1 text-2xl font-black text-prism-text">Review queue</h1>
          <p className="mt-1 text-sm text-prism-muted">Submitted interviews, exactly as the enumerator submitted them.</p>
        </div>
        {/* Debounced: one request once typing pauses, not one per key. */}
        <TableSearch value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search name or code" className="w-full sm:w-72" />
      </header>

      <QueueFilters options={options.data} filters={filters} open={open} onToggle={() => setOpen((v) => !v)}
        onChange={(next) => { setFilters(next); setPage(1); }} />

      <div role="tablist" aria-label="Status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            role="tab"
            aria-selected={status === s.value}
            onClick={() => { setStatus(s.value); setPage(1); }}
            className={clsx("rounded-full px-4 py-2 text-xs font-bold", status === s.value ? "bg-prism-purple text-white" : "bg-white text-prism-muted ring-1 ring-prism-border/70 hover:text-prism-text")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {queue.error ? <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{queue.error}</p> : null}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-prism-border/60">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">PPI initiations</caption>
          <thead className="bg-prism-bg/70 text-[10px] font-black uppercase tracking-[0.12em] text-prism-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Establishment</th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">Questionnaire</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Enumerator</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">Submitted</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {queue.loading && !items.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-prism-muted">Loading…</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-prism-muted">Nothing here.</td></tr>
            ) : items.map((item) => (
              <tr key={item.initiationId} className="border-t border-prism-border/50">
                <td className="px-4 py-3">
                  <p className="font-bold text-prism-text">{item.establishmentName}</p>
                  <p className="text-xs text-prism-muted">{item.establishmentCode} · {[item.districtName, item.regionName].filter(Boolean).join(", ")}</p>
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{QUESTIONNAIRE_LABEL[item.questionnaireType] ?? item.questionnaireType}</td>
                <td className="hidden px-4 py-3 lg:table-cell">{item.enumeratorName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={clsx("inline-block rounded-full px-2.5 py-1 text-[11px] font-bold", STATUS_STYLE[item.workflowStatus])}>
                    {item.workflowStatus === "SUBMITTED" ? `${STAGE_LABEL[item.reviewStage ?? ""] ?? ""} review` : item.workflowStatus.toLowerCase()}
                  </span>
                  {item.submissionNo > 1 ? <span className="ml-2 text-[11px] text-prism-muted">submission {item.submissionNo}</span> : null}
                </td>
                <td className="hidden px-4 py-3 text-xs text-prism-muted sm:table-cell">{formatDateTime(item.submittedAt)}</td>
                <td className="px-4 py-3 text-right">
                  {item.currentSubmissionId ? (
                    <Link href={`/ppi/review/${item.currentSubmissionId}`} className="rounded-full bg-prism-bg px-3 py-1.5 text-xs font-bold text-prism-purple hover:bg-prism-purple hover:text-white">
                      {item.canDecide ? "Review" : "Open"}
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full bg-white px-3 py-1.5 font-bold ring-1 ring-prism-border/70 disabled:opacity-40">Previous</button>
          <span className="text-prism-muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-full bg-white px-3 py-1.5 font-bold ring-1 ring-prism-border/70 disabled:opacity-40">Next</button>
        </nav>
      ) : null}
    </section>
  );
}

// Region (HQ), district and supervisor (HQ, RS), reader (everyone): the
// dashboard's rules. A region narrows the other lists, a supervisor the
// readers; changing one clears the choices below it that no longer fit.
function QueueFilters({ options, filters, open, onToggle, onChange }: {
  options: QueueFilterOptions | null | undefined;
  filters: Filters;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Filters) => void;
}) {
  if (!options) return null;
  const { regionId, supervisorId } = filters;
  const showRegion = options.scope === "NATIONAL";
  const showDistrict = options.scope === "NATIONAL" || options.scope === "REGION";
  const showSupervisor = showDistrict;
  const districts = options.districts.filter((d) => !regionId || d.regionId === regionId || (regionId === NONE && !d.regionId));
  const supervisors = options.supervisors.filter((s) => !regionId || s.regionIds.includes(regionId));
  const readers = options.readers.filter((r) => (!regionId || r.regionIds.includes(regionId)) && (!supervisorId || r.supervisorIds.includes(supervisorId)));
  const active = Object.values(filters).filter(Boolean).length;
  const select = "min-h-10 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs font-bold text-prism-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple";
  const label = "flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted sm:min-w-44 sm:max-w-xs sm:flex-1";
  return (
    <section aria-label="Filters" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prism-border/60 sm:p-5">
      {/* Phones: the filters fold away behind one button. */}
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="ppi-queue-filters"
        className="flex min-h-10 w-full items-center justify-between rounded-xl bg-prism-bg px-3 text-xs font-bold text-prism-text sm:hidden">
        <span>Filters{active ? ` (${active} active)` : ""}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div id="ppi-queue-filters" className={clsx("grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end", open ? "mt-3 grid sm:mt-0" : "hidden")}>
        {showRegion ? (
          <label className={label}>
            Region
            <select value={regionId} data-testid="queue-filter-region" className={select}
              onChange={(e) => onChange({ regionId: e.target.value, districtId: "", supervisorId: "", readerId: "" })}>
              <option value="">All regions</option>
              {options.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        ) : null}
        {showDistrict ? (
          <label className={label}>
            District
            <select value={filters.districtId} data-testid="queue-filter-district" className={select}
              onChange={(e) => onChange({ ...filters, districtId: e.target.value })}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        ) : null}
        {showSupervisor ? (
          <label className={label}>
            Supervisor
            <select value={supervisorId} data-testid="queue-filter-supervisor" className={select}
              onChange={(e) => onChange({ ...filters, supervisorId: e.target.value, readerId: "" })}>
              <option value="">All supervisors</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className={label}>
          Reader
          <select value={filters.readerId} data-testid="queue-filter-reader" className={select}
            onChange={(e) => onChange({ ...filters, readerId: e.target.value })}>
            <option value="">All readers</option>
            {readers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {active ? (
          <button type="button" onClick={() => onChange(NO_FILTERS)} data-testid="queue-filter-clear"
            className="min-h-10 rounded-xl px-3 text-xs font-bold text-prism-purple hover:bg-prism-bg">
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
