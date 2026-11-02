"use client";

import Link from "next/link";
import clsx from "clsx";
import { TableSearch } from "@/components/common/TableSearch";
import { ppiKeys } from "../api";
import { usePpiQuery } from "../usePpiQuery";
import type { Breakdown, EstablishmentRow, InitiationDetail, RemovalRequest, SpecObservations } from "./types";
import { age, count, dateTime, QUESTIONNAIRE_SHORT, SERIES_LABEL, STATUS, statusText, SYNC } from "./format";
import { CsvLink, focusRing, Notice, Panel, Pill } from "./ui";

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Remaining" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "awaiting", label: "Awaiting review" },
  { value: "awaiting_supervisor", label: "At Supervisor" },
  { value: "awaiting_rs", label: "At RS" },
  { value: "awaiting_hq", label: "At HQ" },
  { value: "returned", label: "Returned" },
  { value: "returned_repeat", label: "Returned twice+" },
  { value: "approved", label: "Finally approved" },
];

const PAGE_SIZE = 20;

// Establishments in the current view: server-side filtered, sorted and
// paged. Each row opens its record: the submitted version under review, or
// the category/product breakdown.
export function EstablishmentList({ userId, query, status, search, page, onStatus, onSearch, onPage, onOpen, csvHref }: {
  userId: string;
  query: string;
  status: string;
  search: string;
  page: number;
  onStatus: (status: string) => void;
  onSearch: (search: string) => void;
  onPage: (page: number) => void;
  onOpen: (row: EstablishmentRow) => void;
  csvHref: string;
}) {
  const params = new URLSearchParams(query);
  params.set("level", "establishment");
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const path = `/breakdown?${params}`;
  const list = usePpiQuery<Breakdown<EstablishmentRow>>(ppiKeys.dashboard("breakdown", userId, params.toString()), path);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const label = STATUS_FILTERS.find((s) => s.value === status)?.label ?? "All";

  return (
    <section id="ppi-comparison" aria-labelledby="ppi-establishments-title" className="rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-prism-border/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="ppi-establishments-title" className="text-lg font-black text-prism-text">Establishments{status ? ` · ${label}` : ""}</h2>
            <p className="mt-1 text-xs text-prism-muted">{list.data ? `${count(total)} establishment${total === 1 ? "" : "s"} in this view.` : "Loading…"} Observations are from the latest submitted version; outstanding items are from the server copy as last synced.</p>
          </div>
          <CsvLink href={csvHref} />
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {STATUS_FILTERS.map((s) => (
              <button key={s.value} type="button" aria-pressed={status === s.value} onClick={() => onStatus(s.value)}
                className={clsx("min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold", focusRing, status === s.value ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted hover:text-prism-text")}>
                {s.label}
              </button>
            ))}
          </div>
          <TableSearch value={search} onChange={onSearch} placeholder="Search name or code" className="lg:w-64" />
        </div>
      </div>
      {list.error && <div className="p-4"><Notice tone="error">{list.error}</Notice></div>}
      <div className={clsx(list.loading && "opacity-60")}>
        {!rows.length ? (
          <p className="px-5 py-10 text-center text-sm text-prism-muted">{list.loading ? "Loading…" : "No establishments match this view."}</p>
        ) : (
          <>
            <ul className="divide-y divide-prism-border/60 md:hidden">
              {rows.map((row) => (
                <li key={row.establishmentId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-prism-text">{row.establishmentName}</p>
                      <p className="text-[11px] text-prism-muted">{row.establishmentCode} · {[row.districtName, row.regionName].filter(Boolean).join(", ")}</p>
                      <p className="text-[11px] text-prism-muted">Reader {row.readerName ?? "—"} · Supervisor {row.supervisorName ?? "—"}</p>
                    </div>
                    <Pill className={STATUS[row.status].style}>{statusText(row.status, row.reviewStage)}</Pill>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div><dt className="text-prism-muted">Submissions</dt><dd className="font-black text-prism-text">{count(row.submissions)}</dd></div>
                    <div><dt className="text-prism-muted">Observations</dt><dd className="font-black text-prism-purple">{count(row.observations.total)}</dd></div>
                    <div><dt className="text-prism-muted">Outstanding</dt><dd className="font-black text-prism-text">{row.outstanding === null ? "—" : count(row.outstanding)}</dd></div>
                  </dl>
                  <PriceMonthNote n={row.priceMonthMismatches} />
                  <RowActions row={row} onOpen={onOpen} />
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-xs">
                <caption className="sr-only">Establishments in this view</caption>
                <thead className="text-[10px] uppercase tracking-[0.12em] text-prism-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3">Establishment</th>
                    <th scope="col" className="px-3 py-3">Reader / supervisor</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3 text-right">Submissions</th>
                    <th scope="col" className="px-3 py-3 text-right">Observations</th>
                    <th scope="col" className="px-3 py-3 text-right">Outstanding</th>
                    <th scope="col" className="px-3 py-3">Last submitted</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.establishmentId} className="border-t border-prism-border/60 hover:bg-slate-50/70">
                      <th scope="row" className="max-w-56 px-5 py-3 text-left font-normal">
                        <span className="font-bold text-prism-text">{row.establishmentName}</span>
                        <span className="block text-[10px] text-prism-muted">{row.establishmentCode} · {QUESTIONNAIRE_SHORT[row.questionnaireType] ?? row.questionnaireType} · {[row.districtName, row.regionName].filter(Boolean).join(", ")}</span>
                      </th>
                      <td className="px-3 py-3">
                        <span className="block text-prism-text">{row.readerName ?? "—"}</span>
                        <span className="block text-[10px] text-prism-muted">{row.supervisorName ?? "No supervisor"}</span>
                        {row.readerSync && row.readerSync.state !== "CURRENT" && <Pill className={clsx("mt-0.5", SYNC[row.readerSync.state].style)}>{SYNC[row.readerSync.state].label}</Pill>}
                      </td>
                      <td className="px-3 py-3">
                        <Pill className={STATUS[row.status].style}>{statusText(row.status, row.reviewStage)}</Pill>
                        {row.waitingDays !== null && <span className="block text-[10px] text-prism-muted">{row.status === "RETURNED" ? "returned" : "waiting"} {age(row.waitingDays)}</span>}
                        {row.returns > 1 && <span className="block text-[10px] font-bold text-rose-700">returned {row.returns} times</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{count(row.submissions)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="font-bold text-prism-purple">{count(row.observations.total)}</span>
                        {row.observations.total > 0 && <span className="block text-[10px] text-prism-muted">{row.observations.currentTotal} current · {row.observations.historyTotal} history</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.outstanding === null ? "—" : row.outstanding ? <span className="font-bold text-amber-800">{count(row.outstanding)}</span> : "0"}
                        <PriceMonthNote n={row.priceMonthMismatches} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-prism-muted">{dateTime(row.lastSubmittedAt)}</td>
                      <td className="px-5 py-3 text-right"><RowActions row={row} onOpen={onOpen} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-prism-border px-5 py-4 text-xs text-prism-muted">
          <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {count(total)}</span>
          <span className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={clsx("min-h-9 rounded-full border border-prism-border px-3 font-bold disabled:opacity-35", focusRing)}>Previous</button>
            <span className="font-bold text-prism-text">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={clsx("min-h-9 rounded-full border border-prism-border px-3 font-bold disabled:opacity-35", focusRing)}>Next</button>
          </span>
        </nav>
      )}
    </section>
  );
}

// Non-blocking readiness warning: current price vs the same history month.
function PriceMonthNote({ n }: { n: number | null }) {
  if (!n) return null;
  return <span className="mt-0.5 block text-[10px] font-semibold text-yellow-800" title="Warning only: it does not block submission">{count(n)} price{n === 1 ? " differs" : "s differ"} from the history month</span>;
}

function RowActions({ row, onOpen }: { row: EstablishmentRow; onOpen: (row: EstablishmentRow) => void }) {
  return (
    <span className="mt-3 flex flex-wrap justify-end gap-2 md:mt-0 md:flex-col md:items-stretch">
      {row.initiationId && (
        <button type="button" onClick={() => onOpen(row)} aria-label={`Products of ${row.establishmentName}`} className={clsx("min-h-9 whitespace-nowrap rounded-full bg-prism-bg px-3 text-[11px] font-bold text-prism-purple hover:bg-prism-purple hover:text-white", focusRing)}>
          Products
        </button>
      )}
      {row.currentSubmissionId && (
        <Link href={`/ppi/review/${row.currentSubmissionId}`} aria-label={`${row.status === "SUBMITTED" ? "Review" : "Submission of"} ${row.establishmentName}`} className={clsx("inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full bg-prism-purple px-3 text-[11px] font-bold text-white hover:brightness-110", focusRing)}>
          {row.status === "SUBMITTED" ? "Review" : "Submission"}
        </Link>
      )}
    </span>
  );
}

// One establishment: category > product > specification, with observation
// counts per series and what is still outstanding on the server copy.
export function EstablishmentDetail({ userId, initiationId, onBack }: { userId: string; initiationId: string; onBack: () => void }) {
  const detail = usePpiQuery<InitiationDetail>(ppiKeys.dashboard("initiation", userId, initiationId), `/initiations/${initiationId}/breakdown`);
  if (detail.error && !detail.data) return <Notice tone="error">{detail.error}</Notice>;
  if (!detail.data) return <Notice>Loading the establishment…</Notice>;
  const d = detail.data;
  const m = d.measures as Record<string, number>;
  return (
    <Panel
      id="ppi-comparison"
      title={d.establishment.establishmentName}
      hint={
        <>
          {d.establishment.establishmentCode} · {QUESTIONNAIRE_SHORT[d.initiation.questionnaireType]} · {[d.establishment.districtName, d.establishment.regionName].filter(Boolean).join(", ")}
          {" · "}Reader {d.establishment.readerName ?? "—"} · Supervisor {d.establishment.supervisorName ?? "—"}
        </>
      }
      action={
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={onBack} className={clsx("min-h-9 rounded-full border border-prism-border px-3 text-xs font-bold text-prism-text hover:bg-prism-bg", focusRing)}>← Back to the list</button>
          {d.initiation.currentSubmissionId && (
            <Link href={`/ppi/review/${d.initiation.currentSubmissionId}`} className={clsx("inline-flex min-h-9 items-center rounded-full bg-prism-purple px-3 text-xs font-bold text-white", focusRing)}>Open submitted version</Link>
          )}
        </span>
      }
    >
      {d.initiation.removed ? (
        <div role="status" className="mb-4 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
          <p className="font-black">Removed from the round</p>
          <p className="mt-0.5 text-xs">
            HQ approved the recommendation to remove this establishment{d.initiation.removalRequest?.decidedAt ? ` on ${dateTime(d.initiation.removalRequest.decidedAt)}` : ""}
            {d.initiation.removalRequest ? ` (${REMOVAL_REASON[d.initiation.removalRequest.reason] ?? d.initiation.removalRequest.reason})` : ""}.
            It is left out of every dashboard figure, and the phone can no longer change it. The record below is kept as it was.
          </p>
        </div>
      ) : d.initiation.removalRequest?.state === "OPEN" ? (
        <div role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="text-sm font-black">Removal recommended, waiting for HQ</p>
          <p className="mt-0.5">
            Reason: {REMOVAL_REASON[d.initiation.removalRequest.reason] ?? d.initiation.removalRequest.reason}{d.initiation.removalRequest.note ? ` · ${d.initiation.removalRequest.note}` : ""}
            {d.initiation.removalRequest.requestedAt ? ` · recommended ${dateTime(d.initiation.removalRequest.requestedAt)}` : ""}. It still counts in the figures until HQ decides.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {d.initiation.removed && <Pill className="bg-slate-200 text-slate-800">Removed</Pill>}
        <Pill className={STATUS[d.initiation.workflowStatus].style}>{statusText(d.initiation.workflowStatus, d.initiation.reviewStage)}</Pill>
        <span className="text-prism-muted">
          {d.source === "SUBMISSION"
            ? `Showing submission ${d.initiation.submissionNo}, the latest submitted version.`
            : "Not submitted yet: showing the server copy as last synced. Work still on the phone is not included."}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
        <Stat label="Categories" value={`${count(m.categories)} (${count(m.categories_counted)} with product counts)`} />
        <Stat label="Products recorded / declared" value={`${count(m.products)} / ${count(m.products_declared)}`} />
        <Stat label="Specifications complete" value={`${count(m.specifications_complete)} / ${count(m.specifications)}`} />
        <Stat label="Outstanding items" value={count(m.readiness_issues)} />
      </dl>
      {m.price_month_mismatches > 0 && (
        <p className="mt-3 rounded-xl bg-yellow-50 px-3 py-2 text-[11px] text-yellow-900 ring-1 ring-yellow-200">
          Warning: {count(m.price_month_mismatches)} current price{m.price_month_mismatches === 1 ? " differs" : "s differ"} from the same month in the price history. Check which is right; this does not block submission.
        </p>
      )}
      {d.outstanding.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Outstanding (establishment and revenue)</h3>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">{d.outstanding.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      <div className="mt-5 space-y-4">
        {d.categories.length === 0 && <p className="text-sm text-prism-muted">No major product categories recorded.</p>}
        {d.categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-prism-border/70">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-prism-border/60 bg-prism-bg/50 px-4 py-2.5">
              <h3 className="text-sm font-black text-prism-text">{c.name || "Unnamed category"}</h3>
              <span className="text-[11px] text-prism-muted">{c.productsRecorded} of {c.productCount ?? "?"} products recorded</span>
            </div>
            <Issues list={c.issues} />
            <ul className="divide-y divide-prism-border/50">
              {c.products.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <p className="text-xs font-bold text-prism-text">{p.name || "Unnamed product"}</p>
                  <Issues list={p.issues} />
                  <ul className="mt-2 space-y-1.5">
                    {p.specifications.map((s, n) => (
                      <li key={s.id} className="flex flex-col gap-1 rounded-xl bg-prism-bg/50 px-3 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">
                          <span className="font-semibold text-prism-text">Specification {n + 1}</span>
                          <span className="text-prism-muted"> · {s.description || "no description"}</span>
                          {s.isDraft && <Pill className="ml-2 bg-slate-200 text-slate-800">Draft</Pill>}
                        </span>
                        <SpecCounts observations={s.observations} />
                        {s.issues.length > 0 && <span className="text-amber-900 sm:hidden">{s.issues.length} outstanding</span>}
                      </li>
                    ))}
                  </ul>
                  {p.specifications.some((s) => s.issues.length) && <Issues list={p.specifications.flatMap((s) => s.issues)} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {d.submissions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-prism-muted">Submissions</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {d.submissions.map((s) => (
              <li key={s.submissionId}>
                <Link href={`/ppi/review/${s.submissionId}`} className={clsx("inline-flex min-h-9 items-center rounded-full bg-prism-bg px-3 font-bold text-prism-purple hover:bg-prism-purple hover:text-white", focusRing)}>
                  #{s.submissionNo} · {dateTime(s.submittedAt)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-prism-muted">Each submitted version and the change history open in the review screen.</p>
        </div>
      )}
    </Panel>
  );
}

const REMOVAL_REASON: Record<RemovalRequest["reason"], string> = {
  CLOSED_PERMANENTLY: "closed permanently", DUPLICATE: "duplicate", OUT_OF_SCOPE: "out of scope", CANNOT_LOCATE: "cannot be located", OTHER: "other",
};

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-prism-bg/70 px-3 py-2"><dt className="text-prism-muted">{label}</dt><dd className="mt-0.5 text-sm font-black text-prism-text">{value}</dd></div>;
}

function Issues({ list }: { list: string[] }) {
  if (!list.length) return null;
  return <ul className="mt-1 list-disc space-y-0.5 px-4 pl-9 text-[11px] text-amber-900">{list.slice(0, 6).map((t) => <li key={t}>{t}</li>)}{list.length > 6 && <li>…and {list.length - 6} more</li>}</ul>;
}

function SpecCounts({ observations }: { observations: SpecObservations }) {
  const series = Object.entries(observations) as [keyof typeof SERIES_LABEL, { current: number; history: number; notAvailable: number }][];
  if (!series.length) return <span className="text-prism-muted">No prices</span>;
  return (
    <span className="flex flex-wrap gap-2 tabular-nums">
      {series.map(([s, c]) => (
        <span key={s} className="rounded-full bg-white px-2 py-0.5 font-bold text-prism-text ring-1 ring-prism-border/60">
          {SERIES_LABEL[s]}: {c.current} current · {c.history} history{c.notAvailable ? ` · ${c.notAvailable} n/a` : ""}
        </span>
      ))}
    </span>
  );
}
