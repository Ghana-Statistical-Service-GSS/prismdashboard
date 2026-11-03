"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { formatDateTime, ppiKeys, QUESTIONNAIRE_LABEL, STAGE_LABEL, type QueueItem } from "./api";
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

// PPI initiations in the reviewer's scope (the backend applies the scope:
// a Supervisor sees the establishments they supervise, an RS their region,
// HQ everything).
export function ReviewQueue() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("SUBMITTED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ status, page: String(page), pageSize: "25", ...(search.trim() ? { search: search.trim() } : {}) }).toString();
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
