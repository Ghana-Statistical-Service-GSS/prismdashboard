"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { TablePagination } from "@/components/common/TablePagination";
import { TableSearch } from "@/components/common/TableSearch";
import { useTableControls } from "@/components/common/useTableControls";
import type { GroupLevel, GroupRow, Stage } from "./types";
import { age, count, dateTime, LEVEL_LABEL, pctText, SERIES_LABEL, STAGE_SHORT, SYNC, tone } from "./format";
import { CsvLink, focusRing, Pill, Segmented } from "./ui";

export type Metric = "observations" | "submitted" | "approved";
export type SortChoice = "count" | "coverage" | "name";

const METRICS: { value: Metric; label: string }[] = [
  { value: "observations", label: "Price observations" },
  { value: "submitted", label: "Establishments submitted" },
  { value: "approved", label: "Finally approved" },
];

const value = (row: GroupRow, metric: Metric) => (metric === "observations" ? row.observations.total : metric === "submitted" ? row.submitted : row.approved);
const coverage = (row: GroupRow, metric: Metric) => (metric === "approved" ? row.approvedCoverage : row.coverage);

// Submissions by region (or district, supervisor, reader): CPI's clickable
// horizontal bars with the count on each bar and the coverage beside it, so
// a large region does not look better merely for being large; then the
// comparison table with the same rows. Clicking a bar or a row opens the
// next level with the filters kept.
export function Comparison({ level, rows, stages, metric, sort, onMetric, onSort, onOpen, nextLabel, csvHref, groupBy, loading }: {
  level: GroupLevel;
  rows: GroupRow[];
  stages: Stage[];
  metric: Metric;
  sort: SortChoice;
  onMetric: (metric: Metric) => void;
  onSort: (sort: SortChoice) => void;
  onOpen: ((row: GroupRow) => void) | null;
  nextLabel: string | null;
  csvHref: string;
  groupBy: ReactNode;
  loading: boolean;
}) {
  const names = LEVEL_LABEL[level];
  // Areas with nothing assigned are named in one line, not drawn as empty bars.
  const assignedRows = useMemo(() => rows.filter((r) => r.assigned > 0), [rows]);
  const unassigned = rows.filter((r) => r.assigned === 0);
  const sorted = useMemo(() => {
    const byName = (a: GroupRow, b: GroupRow) => (a.name || "~").localeCompare(b.name || "~");
    return [...assignedRows].sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "coverage") {
        const x = coverage(a, metric);
        const y = coverage(b, metric);
        if (x === y) return byName(a, b);
        if (x === null) return 1;
        if (y === null) return -1;
        return x - y;
      }
      return value(b, metric) - value(a, metric) || byName(a, b);
    });
  }, [assignedRows, sort, metric]);
  const table = useTableControls(sorted, (row) => [row.name, row.parentName, row.regionNames, row.supervisorNames].filter(Boolean).join(" "));
  // A search belongs to one level: drilling in starts unfiltered (the box is
  // hidden for short lists, so a carried-over search could not be cleared).
  // (setQuery is a new function each render: only the level decides.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { table.setQuery(""); }, [level]);
  const max = Math.max(...assignedRows.map((r) => value(r, metric)), 1);
  const metricLabel = METRICS.find((m) => m.value === metric)!.label;
  const withData = assignedRows;
  const top = [...withData].sort((a, b) => value(b, metric) - value(a, metric))[0];
  const lowest = [...withData].filter((r) => r.coverage !== null).sort((a, b) => (a.coverage ?? 0) - (b.coverage ?? 0))[0];
  const [open, setOpen] = useState<string | null>(null);
  const keyOf = (row: GroupRow) => row.key ?? "none";
  const nameOf = (row: GroupRow) => row.name || `No ${names.one.toLowerCase()} recorded`;

  return (
    <section id="ppi-comparison" aria-labelledby="ppi-comparison-title" className={clsx("rounded-3xl border border-prism-border/70 bg-white shadow-sm transition-opacity", loading && "opacity-60")}>
      <div className="flex flex-col gap-3 border-b border-prism-border/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="ppi-comparison-title" className="text-lg font-black text-prism-text">Submissions by {names.one.toLowerCase()}</h2>
            <p className="mt-1 text-xs text-prism-muted">Counts on the bars; coverage is submitted (or approved) against assigned establishments.{nextLabel ? ` Select a ${names.one.toLowerCase()} to see its ${nextLabel}.` : ""}</p>
          </div>
          <CsvLink href={csvHref} />
        </div>
        {groupBy}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Measure" showLabel value={metric} options={METRICS} onChange={onMetric} />
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">
              Sort
              <select value={sort} onChange={(e) => onSort(e.target.value as SortChoice)} className={clsx("min-h-9 rounded-xl border border-prism-border bg-white px-2 py-1.5 text-xs font-bold text-prism-text", focusRing)}>
                <option value="count">Highest count</option>
                <option value="coverage">Lowest coverage</option>
                <option value="name">Name</option>
              </select>
            </label>
        </div>
      </div>

      {!assignedRows.length ? (
        <p className="px-5 py-10 text-center text-sm text-prism-muted">{loading ? "Loading…" : `No ${names.many.toLowerCase()} with assigned establishments in this view.`}</p>
      ) : (
        <>
          {assignedRows.length > 10 && (
            <div className="border-b border-prism-border/60 px-4 py-3 sm:px-5">
              <TableSearch key={level} value={table.query} onChange={table.setQuery} delayMs={150} placeholder={`Search ${names.many.toLowerCase()}`} className="sm:w-72" />
            </div>
          )}
          <figure className="px-4 py-4 sm:px-5">
            <figcaption className="sr-only">
              {`${metricLabel} by ${names.one.toLowerCase()}: ${withData.length} ${names.many.toLowerCase()} with assignments.`}
              {top ? ` Highest ${nameOf(top)} with ${value(top, metric)}.` : ""}
              {lowest ? ` Lowest coverage ${nameOf(lowest)} at ${pctText(lowest.coverage)}.` : ""}
              {" The table below lists the same figures."}
            </figcaption>
            <ul className="space-y-2.5">
              {table.pageRows.map((row) => {
                const v = value(row, metric);
                const c = coverage(row, metric);
                const label = `${nameOf(row)}: ${count(v)} ${metricLabel.toLowerCase()}; ${row.submitted} of ${row.assigned} establishments submitted, coverage ${pctText(c)}.${onOpen && row.assigned ? ` Open ${nextLabel}.` : ""}`;
                const body = (
                  <>
                    <span className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-bold text-prism-text group-hover:text-prism-purple">
                        {nameOf(row)}
                        {row.parentName && <span className="ml-1 font-normal text-prism-muted">· {row.parentName}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums font-black text-prism-purple">{count(v)}</span>
                        <span className={clsx("inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[10px] font-black", tone(c))}>{row.assigned ? pctText(c) : "none assigned"}</span>
                      </span>
                    </span>
                    <span className="mt-1 block h-3 overflow-hidden rounded-full bg-prism-bg">
                      <span className="block h-full rounded-full bg-gradient-to-r from-prism-teal to-prism-purple" style={{ width: `${Math.max((v / max) * 100, v ? 2 : 0)}%` }} />
                    </span>
                    <span className="mt-0.5 block text-[10px] text-prism-muted">
                      {metric === "observations"
                        ? `${count(row.submitted)} of ${count(row.assigned)} establishments submitted`
                        : `${count(v)} of ${count(row.assigned)} assigned`}
                      {metric !== "approved" && row.approved ? ` · ${count(row.approved)} finally approved` : ""}
                    </span>
                  </>
                );
                return (
                  <li key={keyOf(row)}>
                    {onOpen && row.assigned ? (
                      <button type="button" onClick={() => onOpen(row)} aria-label={label} className={clsx("group block w-full rounded-xl px-1 py-1 text-left hover:bg-prism-bg/60", focusRing)}>{body}</button>
                    ) : (
                      // A bar without an action: an image whose name is the figures.
                      <div role="img" aria-label={label} className="px-1 py-1">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </figure>

          <ComparisonTable rows={table.pageRows} level={level} stages={stages} open={open} setOpen={setOpen} onOpen={onOpen} nextLabel={nextLabel} nameOf={nameOf} keyOf={keyOf} />
          {table.total === 0 && <p className="px-5 py-6 text-center text-xs text-prism-muted">{`Nothing matches “${table.query}”.`}</p>}
          {table.total > table.pageSize && (
            <TablePagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
          )}
        </>
      )}
      {unassigned.length > 0 && (
        <p className="border-t border-prism-border/60 px-4 py-3 text-[11px] text-prism-muted sm:px-5">
          <strong className="text-prism-text">No establishments assigned</strong> in {unassigned.length} {unassigned.length === 1 ? names.one.toLowerCase() : names.many.toLowerCase()}: {unassigned.map(nameOf).join(", ")}.
        </p>
      )}
    </section>
  );
}

function ComparisonTable({ rows, level, stages, open, setOpen, onOpen, nextLabel, nameOf, keyOf }: {
  rows: GroupRow[];
  level: GroupLevel;
  stages: Stage[];
  open: string | null;
  setOpen: (key: string | null) => void;
  onOpen: ((row: GroupRow) => void) | null;
  nextLabel: string | null;
  nameOf: (row: GroupRow) => string;
  keyOf: (row: GroupRow) => string;
}) {
  const names = LEVEL_LABEL[level];
  const toggle = (row: GroupRow) => setOpen(open === keyOf(row) ? null : keyOf(row));
  return (
    <>
      {/* Phone: one card per row */}
      <ul className="divide-y divide-prism-border/60 border-t border-prism-border/60 md:hidden" aria-label={`${names.many} compared`}>
        {rows.map((row) => (
          <li key={keyOf(row)} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-prism-text">{nameOf(row)}</p>
                <p className="text-[11px] text-prism-muted">{count(row.readers.reporting)} of {count(row.readers.assigned)} readers reporting</p>
              </div>
              <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black", tone(row.coverage))}>{pctText(row.coverage)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><dt className="text-prism-muted">Submitted</dt><dd className="font-black text-prism-text">{count(row.submitted)}/{count(row.assigned)}</dd></div>
              <div><dt className="text-prism-muted">Observations</dt><dd className="font-black text-prism-purple">{count(row.observations.total)}</dd></div>
              <div><dt className="text-prism-muted">Approved</dt><dd className="font-black text-emerald-700">{count(row.approved)}</dd></div>
              <div><dt className="text-prism-muted">Awaiting</dt><dd className="font-black text-prism-text">{count(row.awaiting)}</dd></div>
              <div><dt className="text-prism-muted">Returned</dt><dd className="font-black text-rose-700">{count(row.returned)}</dd></div>
              <div><dt className="text-prism-muted">Sync follow-up</dt><dd className="font-black text-prism-text">{count(row.syncFollowUp)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => toggle(row)} aria-expanded={open === keyOf(row)} className={clsx("min-h-9 rounded-full bg-prism-bg px-3 text-[11px] font-bold text-prism-text", focusRing)}>{open === keyOf(row) ? "Hide details" : "Details"}</button>
              {onOpen && row.assigned > 0 && <button type="button" onClick={() => onOpen(row)} className={clsx("min-h-9 rounded-full bg-prism-purple px-3 text-[11px] font-bold text-white", focusRing)}>Open {nextLabel} →</button>}
            </div>
            {open === keyOf(row) && <RowDetails row={row} stages={stages} />}
          </li>
        ))}
      </ul>

      {/* Tablet and desktop: core columns, the rest in an expandable row */}
      <div className="relative hidden overflow-x-auto border-t border-prism-border/60 md:block">
        <table className="min-w-full text-left text-xs">
          <caption className="sr-only">{`${names.many}: readers, assigned and submitted establishments, observations, approvals, reviews, returns and sync follow-up`}</caption>
          <thead className="text-[10px] uppercase tracking-[0.12em] text-prism-muted">
            <tr>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Details</span></th>
              <th scope="col" className="py-3 pr-3">{names.one}</th>
              <th scope="col" className="px-2 py-3 text-right">Readers reporting</th>
              <th scope="col" className="px-2 py-3 text-right">Assigned</th>
              <th scope="col" className="px-2 py-3 text-right">Submitted</th>
              <th scope="col" className="px-2 py-3 text-right">Observations</th>
              <th scope="col" className="px-2 py-3 text-right">Finally approved</th>
              <th scope="col" className="px-2 py-3 text-right">Awaiting review</th>
              <th scope="col" className="px-2 py-3 text-right">Returned</th>
              <th scope="col" className="px-2 py-3 text-right">Sync follow-up</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = open === keyOf(row);
              return (
                <Fragment key={keyOf(row)}>
                  <tr className="border-t border-prism-border/60 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggle(row)} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${nameOf(row)}`} className={clsx("grid h-8 w-8 place-items-center rounded-full bg-prism-bg font-black text-prism-muted hover:text-prism-text", focusRing)}>
                        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                      </button>
                    </td>
                    <th scope="row" className="py-3 pr-3 text-left font-normal">
                      <span className="font-bold text-prism-text">{nameOf(row)}</span>
                      {row.parentName && <span className="block text-[10px] text-prism-muted">{row.parentName}</span>}
                      {level === "reader" && row.sync && <span className="mt-0.5 block"><Pill className={SYNC[row.sync.state].style}>{SYNC[row.sync.state].label}</Pill></span>}
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums">{count(row.readers.reporting)} / {count(row.readers.assigned)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-prism-muted">{count(row.assigned)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      <span className="font-black text-prism-text">{count(row.submitted)}</span>{" "}
                      <span className={clsx("ml-1 inline-flex min-w-11 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black", tone(row.coverage))}>{pctText(row.coverage)}</span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums font-bold text-prism-purple">{count(row.observations.total)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-bold text-emerald-700">{count(row.approved)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{count(row.awaiting)}{row.oldestWaitingDays !== null && <span className="block text-[10px] text-prism-muted">oldest {age(row.oldestWaitingDays)}</span>}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-rose-700">{count(row.returned)}{row.returnedRepeat > 0 && <span className="block text-[10px]">{row.returnedRepeat} repeat</span>}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{row.syncFollowUp ? <span className="font-bold text-amber-800">{count(row.syncFollowUp)}</span> : "0"}</td>
                    <td className="px-4 py-3 text-right">
                      {onOpen && row.assigned > 0 && (
                        <button type="button" onClick={() => onOpen(row)} aria-label={`Open the ${nextLabel} of ${nameOf(row)}`} title={`Open ${nextLabel}`} className={clsx("whitespace-nowrap rounded-full bg-prism-bg px-3 py-1.5 font-bold text-prism-purple hover:bg-prism-purple hover:text-white", focusRing)}>
                          Open →
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50/70">
                      <td />
                      <td colSpan={10} className="py-3 pr-4"><RowDetails row={row} stages={stages} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RowDetails({ row, stages }: { row: GroupRow; stages: Stage[] }) {
  const series = (["SELLING", "PURCHASE", "CONTRACT"] as const).filter((s) => row.observations.current[s] + row.observations.history[s] > 0);
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-3 lg:grid-cols-6 md:mt-0">
      <Item label="Submission events" value={`${count(row.events)} (${count(row.resubmissions)} resubmissions)`} />
      <Item label="Not started / in progress" value={`${count(row.notStarted)} / ${count(row.inProgress)}`} />
      <Item label="Awaiting by stage" value={stages.map((s) => `${STAGE_SHORT[s]} ${row.awaitingByStage[s]}`).join(" · ")} />
      <Item label="Current / history prices" value={`${count(row.observations.currentTotal)} / ${count(row.observations.historyTotal)}`} />
      <Item label="History months not available" value={count(row.observations.historyNotAvailable)} />
      <Item label="By series" value={series.length ? series.map((s) => `${SERIES_LABEL[s]} ${count(row.observations.current[s] + row.observations.history[s])}`).join(" · ") : "—"} />
      <Item label="Finally approved coverage" value={pctText(row.approvedCoverage)} />
      <Item label="Oldest waiting / returned" value={`${age(row.oldestWaitingDays)} / ${age(row.oldestReturnDays)}`} />
      <Item label="Returned twice or more" value={count(row.returnedRepeat)} />
      <Item label="Last submission" value={dateTime(row.lastSubmittedAt)} />
      {row.supervisorNames && <Item label="Supervisors" value={row.supervisorNames} />}
      {row.regionNames && <Item label="Regions" value={row.regionNames} />}
      {row.sync && (
        <Item label="Sync" value={`${SYNC[row.sync.state].label} · download ${dateTime(row.sync.lastDownloadAt)} · last change ${dateTime(row.sync.lastChangeAt)}${row.sync.lastUploadRefused ? ` · ${row.sync.lastUploadRefused} refused (${row.sync.lastRefusalCode})` : ""}`} />
      )}
    </dl>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-prism-muted">{label}</dt>
      <dd className="font-bold text-prism-text">{value}</dd>
    </div>
  );
}
