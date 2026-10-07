"use client";

import { useCallback, useState } from "react";
import type { DashboardUser } from "@/lib/auth";
import { TablePagination } from "@/components/common/TablePagination";
import { Decision, DecisionDialog } from "./DecisionDialog";
import { QuoteDetailDrawer } from "./QuoteDetailDrawer";
import { RebasingApiError, ReviewQuote, formatDateTime, formatMoney, number, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

type QueueResponse = { queue: string; total: number; quotes: ReviewQuote[] };

// The backend gives each role exactly one queue and one review endpoint.
const STAGE_BY_ROLE: Record<DashboardUser["role"], { path: "supervisor" | "rs" | "hq"; title: string; subtitle: string; approveLabel: string }> = {
  SUPERVISOR: { path: "supervisor", title: "Pending price review · Supervisor queue", subtitle: "New prices from Market Readers in your markets. Approving sends them to the Regional Statistician.", approveLabel: "Approve" },
  REGIONAL_STATISTICIAN: { path: "rs", title: "Pending price review · Regional queue", subtitle: "Prices already approved by Supervisors in your region. Approving sends them to HQ.", approveLabel: "Approve" },
  HQ: { path: "hq", title: "Pending final approval", subtitle: "Prices approved by Regional Statisticians. Final approval makes them official and eligible as next month's reference.", approveLabel: "Final approve" },
  ADMIN: { path: "hq", title: "Pending final approval", subtitle: "Prices approved by Regional Statisticians. Final approval makes them official and eligible as next month's reference.", approveLabel: "Final approve" },
};

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
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ quote: ReviewQuote; decision: Decision } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Decided quotes disappear immediately; the refetch then confirms the queue.
  const [decided, setDecided] = useState<Set<string>>(() => new Set());

  const params = new URLSearchParams({ periodId, page: String(page), pageSize: String(pageSize) });
  if (flaggedOnly) params.set("flagged", "true");
  const queue = useRebasingQuery<QueueResponse>(`/price-reviews?${params}`, reloadKey);
  const { loading, error } = queue;
  // Only hide decided quotes until the refetch lands; after that the server is
  // the truth (a rejected quote corrected by the reader returns with the same id).
  const hidden = loading ? decided : new Set<string>();
  const quotes = (queue.data?.quotes || []).filter((row) => !hidden.has(row.quote_id));
  const total = Math.max((queue.data?.total || 0) - ((queue.data?.quotes.length || 0) - quotes.length), 0);

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
    setDecided((current) => new Set(current).add(quote.quote_id));
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
          <span className="rounded-full bg-prism-purple/10 px-3 py-1.5 text-xs font-black text-prism-purple">{number.format(total)} waiting</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-prism-bg px-3 py-1.5 text-xs font-bold text-prism-text">
            <input type="checkbox" checked={flaggedOnly} onChange={(event) => { setFlaggedOnly(event.target.checked); setPage(1); }} className="accent-prism-purple" />
            Flagged only
          </label>
        </div>
      </div>

      {notice && <p role="status" className="mx-5 mt-4 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error}</p>}

      <div className={`grid gap-4 p-4 sm:p-5 xl:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
        {quotes.map((quote) => (
          <article key={quote.quote_id} className={`flex flex-col rounded-2xl border p-4 ${quote.price_change_flagged || quote.weight_change_flagged ? "border-rose-200 bg-rose-50/40" : "border-prism-border/70"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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
              {quote.reference_fixed && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">Reference fixed · check details</span>}
              {quote.revision_no > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Correction · revision {quote.revision_no}</span>}
              {quote.review_count > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-prism-muted">{quote.review_count} previous review{quote.review_count === 1 ? "" : "s"}</span>}
              {quote.reference_image_available && <span className="rounded-full bg-prism-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal-800">Reference image</span>}
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
              <button type="button" onClick={() => setDetailId(quote.quote_id)} className="rounded-full border border-prism-border px-3 py-2.5 text-xs font-bold text-prism-text hover:bg-prism-bg">Details</button>
              <button type="button" onClick={() => setPending({ quote, decision: "REJECTED" })} className="rounded-full bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Reject</button>
              <button type="button" onClick={() => setPending({ quote, decision: "APPROVED" })} className="rounded-full bg-teal-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-teal-700">{stage.approveLabel}</button>
            </div>
          </article>
        ))}
        {!loading && quotes.length === 0 && !error && (
          <p className="col-span-full py-10 text-center text-sm text-prism-muted">Nothing is waiting for your review{flaggedOnly ? " among flagged prices" : ""}.</p>
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
          onDecide={detailQuote ? (decision) => setPending({ quote: detailQuote, decision }) : undefined}
          onClose={() => setDetailId(null)}
        />
      )}
    </section>
  );
}
