"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import clsx from "clsx";
import { TableSearch } from "@/components/common/TableSearch";
import { ppiKeys } from "../api";
import { usePpiQuery } from "../usePpiQuery";
import type { Breakdown, EstablishmentRow, InitiationDetail, RemovalRequest, SpecObservations } from "./types";
import { age, count, dateTime, INVITE, QUESTIONNAIRE_SHORT, SERIES_LABEL, STATUS, statusText, SYNC } from "./format";
import { CsvLink, focusRing, LabelledSelect, Notice, Panel, Pill } from "./ui";

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

const PAGE_SIZE = 25;
// The workflow statuses offered in "Status"; a review stage narrows
// "Awaiting review" to one stage (awaiting_supervisor, ...).
const MAIN_STATUSES = STATUS_FILTERS.filter((s) => !s.value.startsWith("awaiting_"));
const STAGES = [{ value: "supervisor", label: "Supervisor" }, { value: "rs", label: "RS" }, { value: "hq", label: "HQ" }];
const TITLE: Record<string, string> = {
  "": "Establishments", open: "Remaining establishments", not_started: "Establishments not started", in_progress: "Establishments in progress",
  submitted: "Submitted establishments", awaiting: "Establishments awaiting review", awaiting_supervisor: "Awaiting Supervisor review",
  awaiting_rs: "Awaiting RS review", awaiting_hq: "Awaiting HQ review", returned: "Returned establishments",
  returned_repeat: "Returned twice or more", approved: "Finally approved establishments",
};
type Sort = { key: "name" | "observations" | "lastSubmitted"; dir: "asc" | "desc" };

// Establishments in the current view: server-side filtered, sorted and
// paged; "Show more" adds the next page below the rows already shown. Each
// row opens the submitted version under review, or the category/product
// breakdown.
export function EstablishmentList({ userId, query, status, search, page, regionId, regions, onStatus, onSearch, onPage, onRegion, onOpen, onMoreFilters, csvHref }: {
  userId: string;
  query: string;
  status: string;
  search: string;
  // Pages shown (the first `page` pages of PAGE_SIZE rows).
  page: number;
  regionId: string | null;
  // Offered only where the scope covers several regions.
  regions: { id: string; name: string }[] | null;
  onStatus: (status: string) => void;
  onSearch: (search: string) => void;
  onPage: (page: number) => void;
  onRegion: (regionId: string | null) => void;
  onOpen: (row: EstablishmentRow) => void;
  onMoreFilters: () => void;
  csvHref: string;
}) {
  const [sort, setSort] = useState<Sort>({ key: "lastSubmitted", dir: "desc" });
  const pathFor = (n: number) => {
    const params = new URLSearchParams(query);
    params.set("level", "establishment");
    params.set("page", String(n));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort.key);
    params.set("dir", sort.dir);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    return params.toString();
  };
  const first = usePpiQuery<Breakdown<EstablishmentRow>>(ppiKeys.dashboard("breakdown", userId, pathFor(1)), `/breakdown?${pathFor(1)}`);
  const total = first.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownPages = Math.min(Math.max(1, page), pages);
  const shown = Math.min(shownPages * PAGE_SIZE, total);
  const more = Math.min(PAGE_SIZE, total - shown);
  const stage = status.startsWith("awaiting_") ? status.slice("awaiting_".length) : "";
  const mainStatus = stage ? "awaiting" : status;
  const rowsOf = (n: number) => (n === 1 ? first.data?.rows : undefined);
  const toggleSort = (key: Sort["key"]) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
    onPage(1);
  };
  const extraPages = Array.from({ length: shownPages - 1 }, (_, k) => k + 2);

  return (
    <section id="ppi-comparison" aria-labelledby="ppi-establishments-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ppi-establishments-title" className="flex flex-wrap items-center gap-3 text-2xl font-black text-prism-text">
            {TITLE[status] ?? "Establishments"}
            {first.data ? <span className="rounded-full bg-violet-100 px-3 py-0.5 text-base font-black text-prism-purple">{count(total)}</span> : null}
          </h2>
          <p className="mt-1 text-sm text-prism-muted">Open an establishment to review its submitted information.</p>
        </div>
        <CsvLink href={csvHref} label="Export CSV" variant="outline" />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <TableSearch value={search} onChange={onSearch} placeholder="Search establishment name or code" className="xl:flex-[1.4]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-[2]">
          <LabelledSelect label="Status" value={mainStatus} onChange={(v) => onStatus(v)}>
            {MAIN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.value === "awaiting" ? "Awaiting review" : s.label}</option>)}
          </LabelledSelect>
          <LabelledSelect label="Review stage" value={stage} onChange={(v) => onStatus(v ? `awaiting_${v}` : mainStatus === "awaiting" ? "awaiting" : mainStatus)}>
            <option value="">All</option>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </LabelledSelect>
          {regions ? (
            <LabelledSelect label="Region" value={regionId ?? ""} onChange={(v) => onRegion(v || null)}>
              <option value="">All</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </LabelledSelect>
          ) : null}
          <button type="button" onClick={onMoreFilters} className={clsx("inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-prism-border bg-white px-4 text-sm font-bold text-prism-text hover:bg-prism-bg", focusRing)}>
            <FiltersIcon /> More filters
          </button>
        </div>
      </div>

      {first.error && <Notice tone="error">{first.error}</Notice>}

      <div className={clsx("overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm", first.loading && "opacity-60")}>
        {!first.data?.rows.length ? (
          <p className="px-5 py-10 text-center text-sm text-prism-muted">{first.loading ? "Loading…" : "No establishments match this view."}</p>
        ) : (
          <>
            <div className="md:hidden">
              <MobileRows rows={rowsOf(1)!} onOpen={onOpen} />
              {extraPages.map((n) => <MorePage key={n} userId={userId} path={pathFor(n)}>{(rows) => <MobileRows rows={rows} onOpen={onOpen} />}</MorePage>)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Establishments in this view</caption>
                <thead className="bg-prism-bg/60 text-sm text-prism-text">
                  <tr>
                    <SortHeader label="Establishment" active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} className="pl-6" />
                    <th scope="col" className="px-3 py-3 font-bold">Assigned staff</th>
                    <th scope="col" className="px-3 py-3 font-bold">Review stage</th>
                    <th scope="col" className="px-3 py-3 text-center font-bold">Submissions</th>
                    <SortHeader label="Price observations" active={sort.key === "observations"} dir={sort.dir} onClick={() => toggleSort("observations")} />
                    <th scope="col" className="px-3 py-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1" title="Items still missing on the server copy as last synced (required answers, prices and checks).">
                        Outstanding <InfoIcon />
                      </span>
                    </th>
                    <SortHeader label="Last submitted" active={sort.key === "lastSubmitted"} dir={sort.dir} onClick={() => toggleSort("lastSubmitted")} />
                    <th scope="col" className="px-6 py-3 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <TableRows rows={rowsOf(1)!} onOpen={onOpen} />
                {extraPages.map((n) => <MorePage key={n} userId={userId} path={pathFor(n)}>{(rows) => <TableRows rows={rows} onOpen={onOpen} />}</MorePage>)}
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-prism-border/60 px-6 py-4">
              <p className="text-sm text-prism-muted">Showing {count(shown)} of {count(total)} establishment{total === 1 ? "" : "s"}</p>
              {more > 0 ? (
                <button type="button" onClick={() => onPage(shownPages + 1)} className={clsx("inline-flex min-h-10 items-center gap-2 rounded-xl border border-prism-purple px-4 text-sm font-bold text-prism-purple hover:bg-violet-50", focusRing)}>
                  Show {count(more)} more <span aria-hidden="true">⌄</span>
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
      <p className="flex items-center gap-2 text-sm text-prism-muted"><InfoIcon /> Price observations reflect the latest submission. Outstanding items reflect the latest synced server copy.</p>
    </section>
  );
}

// A further page of rows, fetched when shown.
function MorePage({ userId, path, children }: { userId: string; path: string; children: (rows: EstablishmentRow[]) => ReactNode }) {
  const list = usePpiQuery<Breakdown<EstablishmentRow>>(ppiKeys.dashboard("breakdown", userId, path), `/breakdown?${path}`);
  if (!list.data) return null;
  return <>{children(list.data.rows)}</>;
}

function SortHeader({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={clsx("px-3 py-3", className)}>
      <button type="button" onClick={onClick} className={clsx("inline-flex items-center gap-1 whitespace-nowrap font-bold", focusRing)}>
        {label}<span aria-hidden="true" className={clsx(!active && "opacity-0")}>{dir === "asc" ? "↑" : "↓"}</span>
      </button>
    </th>
  );
}

function TableRows({ rows, onOpen }: { rows: EstablishmentRow[]; onOpen: (row: EstablishmentRow) => void }) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={row.establishmentId} className="border-t border-prism-border/60 align-middle hover:bg-slate-50/70">
          <th scope="row" className="max-w-xs py-4 pl-6 pr-3 text-left font-normal">
            <span className="block text-base font-black leading-snug text-prism-text">{row.establishmentName}</span>
            <span className="block text-xs text-prism-muted">{row.establishmentCode} · {QUESTIONNAIRE_SHORT[row.questionnaireType] ?? row.questionnaireType}</span>
            <span className="block text-xs text-prism-muted">{[row.districtName, row.regionName].filter(Boolean).join(" · ") || "—"}</span>
          </th>
          <td className="px-3 py-4">
            <Staff name={row.readerName} role="Enumerator" />
            <Staff name={row.supervisorName} role="Supervisor" missing="No supervisor" />
            {row.readerSync && row.readerSync.state !== "CURRENT" && <Pill className={clsx("mt-1", SYNC[row.readerSync.state].style)}>{SYNC[row.readerSync.state].label}</Pill>}
          </td>
          <td className="px-3 py-4">
            <span className={clsx("inline-block whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold", STATUS[row.status].style)}>{statusText(row.status, row.reviewStage)}</span>
            {row.waitingDays !== null && <span className="mt-1 block text-xs text-prism-muted">{row.status === "RETURNED" ? "Returned " : ""}{capitalise(age(row.waitingDays))}</span>}
            {row.returns > 1 && <span className="block text-xs font-bold text-rose-700">Returned {row.returns} times</span>}
            <FirmNote row={row} />
          </td>
          <td className="px-3 py-4 text-center tabular-nums">{count(row.submissions)}</td>
          <td className="px-3 py-4 tabular-nums">
            <span className="block text-lg font-black text-prism-purple">{count(row.observations.total)}</span>
            {row.observations.total > 0 && <span className="block whitespace-nowrap text-xs text-prism-muted">{count(row.observations.currentTotal)} current · {count(row.observations.historyTotal)} historical</span>}
          </td>
          <td className="px-3 py-4 text-center tabular-nums">
            {row.outstanding === null ? "—" : row.outstanding ? <span className="font-bold text-amber-800">{count(row.outstanding)}</span> : "0"}
            <PriceMonthNote n={row.priceMonthMismatches} />
          </td>
          <td className="whitespace-nowrap px-3 py-4"><DateTimeLines value={row.lastSubmittedAt} /></td>
          <td className="px-6 py-4 text-center"><RowActions row={row} onOpen={onOpen} /></td>
        </tr>
      ))}
    </tbody>
  );
}

function MobileRows({ rows, onOpen }: { rows: EstablishmentRow[]; onOpen: (row: EstablishmentRow) => void }) {
  return (
    <ul className="divide-y divide-prism-border/60 border-b border-prism-border/60">
      {rows.map((row) => (
        <li key={row.establishmentId} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-black text-prism-text">{row.establishmentName}</p>
              <p className="text-xs text-prism-muted">{row.establishmentCode} · {QUESTIONNAIRE_SHORT[row.questionnaireType] ?? row.questionnaireType}</p>
              <p className="text-xs text-prism-muted">{[row.districtName, row.regionName].filter(Boolean).join(" · ")}</p>
            </div>
            <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", STATUS[row.status].style)}>{statusText(row.status, row.reviewStage)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Staff name={row.readerName} role="Enumerator" />
            <Staff name={row.supervisorName} role="Supervisor" missing="No supervisor" />
          </div>
          <FirmNote row={row} />
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-prism-muted">Submissions</dt><dd className="font-black text-prism-text">{count(row.submissions)}</dd></div>
            <div><dt className="text-prism-muted">Observations</dt><dd className="font-black text-prism-purple">{count(row.observations.total)}</dd></div>
            <div><dt className="text-prism-muted">Outstanding</dt><dd className="font-black text-prism-text">{row.outstanding === null ? "—" : count(row.outstanding)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-prism-muted">Last submitted {dateTime(row.lastSubmittedAt)}{row.waitingDays !== null ? ` · waiting ${age(row.waitingDays)}` : ""}</p>
          <PriceMonthNote n={row.priceMonthMismatches} />
          <div className="mt-3"><RowActions row={row} onOpen={onOpen} /></div>
        </li>
      ))}
    </ul>
  );
}

function Staff({ name, role, missing = "—" }: { name: string | null; role: string; missing?: string }) {
  return (
    <span className="mb-1.5 block last:mb-0">
      <span className="block font-semibold text-prism-text">{name ?? missing}</span>
      <span className="block text-xs text-prism-muted">{role}</span>
    </span>
  );
}

function DateTimeLines({ value }: { value: string | null }) {
  if (!value) return <span className="text-prism-muted">—</span>;
  const date = new Date(value);
  return (
    <>
      <span className="block text-prism-text">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)}</span>
      <span className="block text-prism-muted">{new Intl.DateTimeFormat("en-GH", { hour: "numeric", minute: "2-digit" }).format(date)}</span>
    </>
  );
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function InfoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}
function FiltersIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
}

// Non-blocking readiness warning: current price vs the same history month.
function PriceMonthNote({ n }: { n: number | null }) {
  if (!n) return null;
  return <span className="mt-0.5 block text-[11px] font-semibold text-yellow-800" title="Warning only: it does not block submission">{count(n)} price{n === 1 ? " differs" : "s differ"} from the history month</span>;
}

function RowActions({ row, onOpen }: { row: EstablishmentRow; onOpen: (row: EstablishmentRow) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-2 md:flex-col md:items-center md:gap-1.5">
      {row.currentSubmissionId && (
        <Link href={`/ppi/review/${row.currentSubmissionId}`} aria-label={`${row.status === "SUBMITTED" ? "Review" : "Submission of"} ${row.establishmentName}`} className={clsx("inline-flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-prism-purple px-5 text-sm font-bold text-white hover:brightness-110", focusRing)}>
          {row.status === "SUBMITTED" ? "Review" : "Submission"} <span aria-hidden="true">→</span>
        </Link>
      )}
      {row.initiationId && (
        <button type="button" onClick={() => onOpen(row)} aria-label={`Products of ${row.establishmentName}`} className={clsx("min-h-8 whitespace-nowrap rounded-lg px-2 text-sm font-bold text-prism-purple hover:underline", focusRing)}>
          Products
        </button>
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

// Firm self-interview: "Self-completed" when the firm entered answers on
// the web form, the latest invite's status, and failed invite messages.
// A status this screen does not know yet (a newer server): shown as sent.
const UNKNOWN_INVITE = { label: "", style: "bg-slate-100 text-slate-700" };
function FirmNote({ row }: { row: EstablishmentRow }) {
  if (!row.inviteStatus && row.mode !== "SELF") return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {row.mode === "SELF" && <Pill className="bg-violet-600 text-white">Self-completed</Pill>}
      {row.inviteStatus && <Pill className={(INVITE[row.inviteStatus] ?? UNKNOWN_INVITE).style}>{(INVITE[row.inviteStatus] ?? { label: row.inviteStatus }).label}</Pill>}
      {(row.messageFailures ?? 0) > 0 && <span className="text-[10px] font-bold text-rose-700">{row.messageFailures} message{row.messageFailures === 1 ? "" : "s"} not sent</span>}
    </span>
  );
}
