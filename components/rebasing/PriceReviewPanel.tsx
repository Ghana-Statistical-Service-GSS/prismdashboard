"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { TablePagination } from "@/components/common/TablePagination";
import { Decision, DecisionDialog } from "./DecisionDialog";
import { QuoteDetailDrawer } from "./QuoteDetailDrawer";
import { RebasingApiError, ReviewQuote, ReviewStatus, formatDateTime, formatMoney, number, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

type QueueResponse = { queue: string; statuses: ReviewStatus[]; actionable_statuses: ReviewStatus[]; total: number; quotes: ReviewQuote[] };
type BulkResult = { approved: { quote_id: string }[]; skipped: { quote_id: string; code: string; message: string }[] };

// Where a price is in the review chain, as reviewers see it.
const STATUS_CHIP: Record<ReviewStatus, { label: string; className: string }> = {
  PENDING_SUPERVISOR: { label: "Waiting for Supervisor", className: "bg-amber-100 text-amber-800" },
  PENDING_RS: { label: "Waiting for Regional Statistician", className: "bg-sky-100 text-sky-800" },
  PENDING_HQ: { label: "Waiting for HQ", className: "bg-violet-100 text-violet-800" },
  FINAL_APPROVED: { label: "Final approved", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected · with reader", className: "bg-rose-100 text-rose-700" },
};
const STAGE_NAME = { SUPERVISOR: "Supervisor", RS: "Regional Statistician", HQ: "HQ" } as const;

// The backend gives each role one review endpoint; its queue is what that
// stage can act on (the RS may act before the Supervisor).
const STAGE_BY_ROLE: Record<DashboardUser["role"], { path: "supervisor" | "rs" | "hq"; title: string; subtitle: string; approveLabel: string }> = {
  SUPERVISOR: { path: "supervisor", title: "Pending price review · Supervisor queue", subtitle: "New prices from Market Readers in your markets. Approving sends them to the Regional Statistician.", approveLabel: "Approve" },
  REGIONAL_STATISTICIAN: { path: "rs", title: "Pending price review · Regional queue", subtitle: "Prices from your region. Approve after the Supervisor, or act first when needed - the price then goes straight to HQ and the Supervisor sees it as approved by you.", approveLabel: "Approve" },
  HQ: { path: "hq", title: "Pending final approval", subtitle: "Prices approved by Regional Statisticians. Final approval makes them official and eligible as next month's reference.", approveLabel: "Final approve" },
  ADMIN: { path: "hq", title: "Pending final approval", subtitle: "Prices approved by Regional Statisticians. Final approval makes them official and eligible as next month's reference.", approveLabel: "Final approve" },
};

// The status a role's own stage normally acts on (the RS also sees PENDING_SUPERVISOR).
const stageStatus = (role: DashboardUser["role"]): ReviewStatus =>
  role === "SUPERVISOR" ? "PENDING_SUPERVISOR" : role === "REGIONAL_STATISTICIAN" ? "PENDING_RS" : "PENDING_HQ";

export function ChangeChip({ pct, flagged }: { pct: string | null; flagged: boolean }) {
  if (pct === null || pct === undefined) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-prism-muted">No reference</span>;
  const value = Number(pct);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${flagged ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%{flagged ? " · flagged" : ""}
    </span>
  );
}

export function PriceReviewPanel({ periodId, role, onChanged }: { periodId: string; role: DashboardUser["role"]; onChanged: () => void }) {
  const stage = STAGE_BY_ROLE[role];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(20);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [view, setView] = useState<"queue" | "all">("queue");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [approving, setApproving] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ quote: ReviewQuote; decision: Decision } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Decided quotes disappear immediately; the refetch then confirms the queue.
  const [decided, setDecided] = useState<Set<string>>(() => new Set());

  const params = new URLSearchParams({ periodId, page: String(page), pageSize: String(pageSize) });
  if (flaggedOnly) params.set("flagged", "true");
  if (view === "all") params.set("view", "all");
  const queue = useRebasingQuery<QueueResponse>(`/price-reviews?${params}`, reloadKey);
  const { loading, error } = queue;
  // Only hide decided quotes until the refetch lands; after that the server is
  // the truth (a rejected quote corrected by the reader returns with the same id).
  const hidden = loading ? decided : new Set<string>();
  const quotes = (queue.data?.quotes || []).filter((row) => !hidden.has(row.quote_id));
  const total = Math.max((queue.data?.total || 0) - ((queue.data?.quotes.length || 0) - quotes.length), 0);
  const actionable = new Set<ReviewStatus>(queue.data?.actionable_statuses || []);
  const canAct = (quote: ReviewQuote) => actionable.has(quote.review_status);
  const selectable = quotes.filter(canAct);
  const selectedIds = selectable.filter((quote) => selected.has(quote.quote_id)).map((quote) => quote.quote_id);
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const markDecided = (ids: string[]) => {
    setDecided((current) => new Set([...current, ...ids]));
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
  };

  // One tap: the card leaves at once; on failure it comes back with the reason.
  const quickApprove = async (quote: ReviewQuote) => {
    setActionError("");
    setApproving((current) => new Set(current).add(quote.quote_id));
    try {
      await rebasingApi(`/price-reviews/${quote.quote_id}/${stage.path}`, { method: "POST", body: { decision: "APPROVED" } });
      markDecided([quote.quote_id]);
      setNotice(`${quote.product_name} at ${quote.outlet_name} approved.`);
      setReloadKey((key) => key + 1);
      onChanged();
    } catch (failure) {
      setActionError(`${quote.product_name}: ${failure instanceof Error ? failure.message : "could not be approved."}`);
      if (failure instanceof RebasingApiError && failure.status === 409) setReloadKey((key) => key + 1);
    } finally {
      setApproving((current) => { const next = new Set(current); next.delete(quote.quote_id); return next; });
    }
  };

  const approveSelected = async () => {
    if (!selectedIds.length || bulkBusy) return;
    setBulkBusy(true);
    setActionError("");
    try {
      const result = await rebasingApi<BulkResult>("/price-reviews/bulk-approve", { method: "POST", body: { quoteIds: selectedIds } });
      markDecided(result.approved.map((row) => row.quote_id));
      const skipped = result.skipped.length ? ` ${result.skipped.length} skipped (already reviewed or not yours to approve).` : "";
      setNotice(`${result.approved.length} price${result.approved.length === 1 ? "" : "s"} approved.${skipped}`);
      setReloadKey((key) => key + 1);
      onChanged();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "The prices could not be approved.");
    } finally {
      setBulkBusy(false);
    }
  };

  const decide = useCallback(async (quote: ReviewQuote, decision: Decision, text: string) => {
    const body = decision === "REJECTED" ? { decision, reason: text } : { decision, ...(text ? { comment: text } : {}) };
    try {
      await rebasingApi(`/price-reviews/${quote.quote_id}/${stage.path}`, { method: "POST", body });
    } catch (reason) {
      // 409 = someone else already moved this quote; refresh so the list is truthful.
      if (reason instanceof RebasingApiError && reason.status === 409) setReloadKey((key) => key + 1);
      throw reason;
    }
    setPending(null);
    setDetailId(null);
    markDecided([quote.quote_id]);
    setNotice(`${quote.product_name} at ${quote.outlet_name} ${decision === "APPROVED" ? "approved" : "rejected and returned to the reader"}.`);
    setReloadKey((key) => key + 1);
    onChanged();
  }, [stage.path, onChanged]);

  const detailQuote = quotes.find((row) => row.quote_id === detailId) || null;

  return (
    <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-prism-border/70 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black text-prism-text">{stage.title}</h2>
          <p className="mt-1 max-w-2xl text-xs text-prism-muted">{stage.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-prism-purple/10 px-3 py-1.5 text-xs font-black text-prism-purple">{number.format(total)} {view === "all" ? "prices" : "waiting"}</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-prism-bg px-3 py-1.5 text-xs font-bold text-prism-text">
            <input type="checkbox" checked={flaggedOnly} onChange={(event) => { setFlaggedOnly(event.target.checked); setPage(1); }} className="accent-prism-purple" />
            Flagged only
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-prism-border/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full bg-prism-bg p-1">
          {([["queue", "To review"], ["all", "All prices"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => { setView(key); setPage(1); setSelected(new Set()); }} className={clsx("rounded-full px-4 py-1.5 text-xs font-bold", view === key ? "bg-white text-prism-purple shadow-sm" : "text-prism-muted")}>{label}</button>
          ))}
        </div>
        {selectable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-prism-text">
              <input type="checkbox" className="accent-prism-purple" checked={selectedIds.length === selectable.length}
                onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((quote) => quote.quote_id)) : new Set())} />
              Select all on page
            </label>
            <button type="button" disabled={!selectedIds.length || bulkBusy} onClick={() => void approveSelected()} className="rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40">
              {bulkBusy ? "Approving…" : `Approve selected (${selectedIds.length})`}
            </button>
          </div>
        )}
      </div>

      {notice && <p role="status" className="mx-5 mt-4 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">{notice}</p>}
      {(error || actionError) && <p role="alert" className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error || actionError}</p>}

      <div className={`grid gap-4 p-4 sm:p-5 xl:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
        {quotes.map((quote) => (
          <article key={quote.quote_id} className={clsx("flex flex-col rounded-2xl border p-4", quote.price_change_flagged || quote.weight_change_flagged ? "border-rose-200 bg-rose-50/40" : "border-prism-border/70", approving.has(quote.quote_id) && "opacity-50")}>
            <div className="flex items-start justify-between gap-3">
              {canAct(quote) && (
                <input type="checkbox" aria-label={`Select ${quote.product_name}`} className="mt-1 accent-prism-purple" checked={selected.has(quote.quote_id)} onChange={() => toggle(quote.quote_id)} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-prism-text">{quote.product_name}</p>
                <p className="truncate text-[11px] text-prism-muted">{quote.item_name}</p>
              </div>
              <ChangeChip pct={quote.price_change_pct} flagged={quote.price_change_flagged} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-prism-border/60">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-prism-muted">Current</p>
                <p className="text-lg font-black text-prism-purple">{formatMoney(quote.price)}</p>
                <p className="text-[11px] text-prism-muted">{quote.weight ? `${quote.weight} ${quote.uom_standard || quote.uom_local || ""}` : quote.uom_local || "—"}</p>
                {quote.weight_change_pct !== null && (
                  <p className={`text-[11px] font-bold ${quote.weight_change_flagged ? "text-rose-700" : "text-emerald-700"}`}>
                    Weight {Number(quote.weight_change_pct) > 0 ? "+" : ""}{Number(quote.weight_change_pct).toFixed(1)}%{quote.weight_change_flagged ? " · flagged" : ""}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-prism-muted">Previous {quote.reference_fixed && quote.original_previous_price !== null ? "(fixed by reader)" : quote.reference_source === "BASELINE" ? "(baseline)" : ""}</p>
                <p className="text-lg font-black text-prism-text">{formatMoney(quote.previous_price)}</p>
                {quote.reference_fixed && quote.original_previous_price !== null && (
                  <p className="text-[11px] text-amber-800">was <span className="line-through">{formatMoney(quote.original_previous_price)}</span></p>
                )}
                <p className="text-[11px] text-prism-muted">{quote.previous_weight ? `${quote.previous_weight} ${quote.uom_standard || quote.uom_local || ""}` : "—"}</p>
                {quote.reference_fixed && quote.original_previous_weight !== null && (
                  <p className="text-[11px] text-amber-800">weight was <span className="line-through">{quote.original_previous_weight}</span></p>
                )}
              </div>
            </div>

            <dl className="mt-3 space-y-1 text-[11px]">
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-prism-muted">Outlet</dt><dd className="min-w-0 truncate font-semibold text-prism-text">{quote.outlet_name}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-prism-muted">Market</dt><dd className="min-w-0 truncate text-prism-text">{quote.market_name} · {quote.district_name} · {quote.region_name}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-prism-muted">Reader</dt><dd className="min-w-0 truncate text-prism-text">{quote.reader_name} · Week {quote.week_no} · {formatDateTime(quote.submitted_at)}</dd></div>
              {quote.reason_for_change && <div className="flex gap-2"><dt className="w-16 shrink-0 text-prism-muted">Reason</dt><dd className="min-w-0 italic text-prism-text">“{quote.reason_for_change}”</dd></div>}
              {quote.reference_fixed && quote.reference_fix_reason && <div className="flex gap-2"><dt className="w-16 shrink-0 text-amber-800">Fix</dt><dd className="min-w-0 italic text-amber-900">“{quote.reference_fix_reason}”</dd></div>}
            </dl>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(view === "all" || quote.review_status !== stageStatus(role)) && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_CHIP[quote.review_status].className}`}>
                  {STATUS_CHIP[quote.review_status].label}
                </span>
              )}
              {quote.last_review_stage && quote.review_status !== "PENDING_SUPERVISOR" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-prism-muted">
                  {`${quote.review_status === "REJECTED" ? "Rejected" : "Approved"} by ${STAGE_NAME[quote.last_review_stage]}`}
                </span>
              )}
              {quote.reference_fixed && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">Reference fixed · check details</span>}
              {quote.revision_no > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Correction · revision {quote.revision_no}</span>}
              {quote.review_count > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-prism-muted">{quote.review_count} previous review{quote.review_count === 1 ? "" : "s"}</span>}
              {quote.reference_image_available && <span className="rounded-full bg-prism-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal-800">Reference image</span>}
            </div>

            <div className={clsx("mt-auto grid gap-2 pt-4", canAct(quote) ? "grid-cols-3" : "grid-cols-1")}>
              <button type="button" onClick={() => setDetailId(quote.quote_id)} className="rounded-full border border-prism-border px-3 py-2.5 text-xs font-bold text-prism-text hover:bg-prism-bg">Details</button>
              {canAct(quote) && (
                <>
                  <button type="button" disabled={approving.has(quote.quote_id)} onClick={() => setPending({ quote, decision: "REJECTED" })} className="rounded-full bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-40">Reject</button>
                  <button type="button" disabled={approving.has(quote.quote_id)} onClick={() => void quickApprove(quote)} className="rounded-full bg-teal-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-60">
                    {approving.has(quote.quote_id) ? "Approving…" : stage.approveLabel}
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {!loading && quotes.length === 0 && !error && (
          <p className="col-span-full py-10 text-center text-sm text-prism-muted">{view === "all" ? "No prices synced yet" : "Nothing is waiting for your review"}{flaggedOnly ? " among flagged prices" : ""}.</p>
        )}
      </div>

      {total > pageSize && (
        <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      )}

      {pending && (
        <DecisionDialog
          decision={pending.decision}
          approveLabel={stage.approveLabel}
          title={`${pending.quote.product_name} · ${formatMoney(pending.quote.price)}`}
          summary={
            <div className="space-y-1">
              <p><strong>{pending.quote.outlet_name}</strong>, {pending.quote.market_name}</p>
              {pending.quote.reference_fixed && <p className="font-bold text-amber-800">The reader fixed the reference: {pending.quote.reference_fix_reason}</p>}
              <p>Previous {formatMoney(pending.quote.previous_price)} · <ChangeChip pct={pending.quote.price_change_pct} flagged={pending.quote.price_change_flagged} /></p>
              <p className="text-prism-muted">Collected by {pending.quote.reader_name}</p>
            </div>
          }
          onSubmit={(text) => decide(pending.quote, pending.decision, text)}
          onClose={() => setPending(null)}
        />
      )}

      {detailId && (
        <QuoteDetailDrawer
          quoteId={detailId}
          approveLabel={stage.approveLabel}
          onDecide={detailQuote && canAct(detailQuote) ? (decision) => setPending({ quote: detailQuote, decision }) : undefined}
          onClose={() => setDetailId(null)}
        />
      )}
    </section>
  );
}
