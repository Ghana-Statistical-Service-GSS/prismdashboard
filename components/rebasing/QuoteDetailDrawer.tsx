"use client";

import { useEffect, useState } from "react";
import type { Decision } from "./DecisionDialog";
import { QuoteReview, QuoteRevision, ReviewQuote, formatDateTime, formatMoney, rebasingApi } from "./api";

type DetailResponse = { quote: ReviewQuote; reviews: QuoteReview[]; revisions: QuoteRevision[] };
type ImageState = { status: "idle" | "loading" | "error"; message?: string } | { status: "ready"; url: string; expiresAt: string };

const STAGE_LABEL = { SUPERVISOR: "Supervisor", RS: "Regional Statistician", HQ: "HQ" } as const;

export function QuoteDetailDrawer({ quoteId, approveLabel, onDecide, onClose }: {
  quoteId: string;
  approveLabel: string;
  onDecide?: (decision: Decision) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState<ImageState>({ status: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    rebasingApi<DetailResponse>(`/price-reviews/${quoteId}`, { signal: controller.signal })
      .then(setDetail)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [quoteId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Presigned MinIO URLs are short-lived (5 min), so they are fetched on demand, never cached.
  const loadImage = async (frameId: string) => {
    setImage({ status: "loading" });
    try {
      const data = await rebasingApi<{ url: string; expires_at: string }>(`/reference-images/${frameId}/url`);
      setImage({ status: "ready", url: data.url, expiresAt: data.expires_at });
    } catch (reason) {
      setImage({ status: "error", message: reason instanceof Error ? reason.message : "Reference image unavailable" });
    }
  };

  const quote = detail?.quote;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/45 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="quote-detail-title" className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-lg">
        <header className="flex items-start justify-between gap-4 border-b border-prism-border/70 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">Price detail</p>
            <h2 id="quote-detail-title" className="mt-1 truncate text-lg font-black text-prism-text">{quote?.product_name || "Loading…"}</h2>
            {quote && <p className="truncate text-xs text-prism-muted">{quote.item_code ? `${quote.item_code} · ` : ""}{quote.item_name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted hover:text-prism-text">×</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-xs">
          {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
          {!quote && !error && <p className="py-10 text-center text-prism-muted">Loading price detail…</p>}

          {quote && (
            <>
              <section className="grid grid-cols-2 gap-3">
                {[
                  ["Current price", formatMoney(quote.price)],
                  [`Previous price${quote.reference_source === "BASELINE" ? " (baseline)" : ""}`, formatMoney(quote.previous_price)],
                  ["Change", quote.price_change_pct === null ? "No reference" : `${Number(quote.price_change_pct) > 0 ? "+" : ""}${Number(quote.price_change_pct).toFixed(1)}%${quote.price_change_flagged ? " (flagged)" : ""}`],
                  ["Revision", String(quote.revision_no)],
                  ["Weight", quote.weight || "—"],
                  ["Previous weight", quote.previous_weight || "—"],
                  ["Weight change", quote.weight_change_pct === null ? "Not compared" : `${Number(quote.weight_change_pct) > 0 ? "+" : ""}${Number(quote.weight_change_pct).toFixed(1)}%${quote.weight_change_flagged ? " (flagged)" : ""}`],
                  ["UoM", [quote.uom_local, quote.uom_standard].filter(Boolean).join(" / ") || "—"],
                  ["Status", quote.review_status.replaceAll("_", " ")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-prism-bg/70 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-prism-muted">{label}</p>
                    <p className="mt-1 text-sm font-black text-prism-text">{value}</p>
                  </div>
                ))}
              </section>

              {quote.reference_fixed && <ReferenceFixSection quote={quote} />}

              <section className="space-y-1.5 rounded-2xl border border-prism-border/70 p-4">
                <p><span className="text-prism-muted">Reader:</span> <strong>{quote.reader_name}</strong></p>
                <p><span className="text-prism-muted">Outlet:</span> {quote.outlet_name}{quote.outlet_code ? ` (${quote.outlet_code})` : ""}</p>
                <p><span className="text-prism-muted">Market:</span> {quote.market_name} · {quote.district_name} · {quote.region_name}</p>
                <p><span className="text-prism-muted">Week:</span> {quote.week_no} · captured {formatDateTime(quote.captured_at)} · submitted {formatDateTime(quote.submitted_at)}</p>
                {quote.description && <p><span className="text-prism-muted">Description:</span> {quote.description}</p>}
                {quote.brand && <p><span className="text-prism-muted">Brand:</span> {quote.brand}</p>}
                {quote.reason_for_change && <p><span className="text-prism-muted">Reader reason:</span> <em>“{quote.reason_for_change}”</em></p>}
              </section>

              <section className="rounded-2xl border border-prism-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-prism-text">Reference image</h3>
                  {quote.reference_image_available && image.status !== "ready" && (
                    <button type="button" disabled={image.status === "loading"} onClick={() => loadImage(quote.frame_id)} className="rounded-full bg-prism-purple px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                      {image.status === "loading" ? "Loading…" : "View image"}
                    </button>
                  )}
                </div>
                {!quote.reference_image_available && <p className="mt-2 text-prism-muted">No initiation reference image exists for this product.</p>}
                {image.status === "error" && <p className="mt-2 text-red-700">{image.message}</p>}
                {image.status === "ready" && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived presigned MinIO URL */}
                    <img src={image.url} alt={`Reference for ${quote.product_name}`} className="mt-3 max-h-80 w-full rounded-xl bg-prism-bg object-contain" />
                    <p className="mt-1 text-[10px] text-prism-muted">Link expires {formatDateTime(image.expiresAt)}.</p>
                  </>
                )}
              </section>

              <section>
                <h3 className="text-sm font-black text-prism-text">Review history</h3>
                {detail.reviews.length === 0 && <p className="mt-2 text-prism-muted">No reviews yet.</p>}
                <ol className="mt-3 space-y-3 border-l-2 border-prism-border pl-4">
                  {detail.reviews.map((review) => (
                    <li key={review.review_id} className="relative">
                      <span className={`absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full ${review.decision === "APPROVED" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <p className="font-bold text-prism-text">{STAGE_LABEL[review.stage]} {review.decision === "APPROVED" ? "approved" : "rejected"} · rev {review.quote_revision_no}</p>
                      <p className="text-prism-muted">{review.reviewed_by_name} · {formatDateTime(review.reviewed_at)}</p>
                      {review.reason && <p className="mt-0.5 text-prism-text">Reason: {review.reason}</p>}
                      {review.comment && <p className="mt-0.5 text-prism-text">Note: {review.comment}</p>}
                    </li>
                  ))}
                </ol>
              </section>

              {detail.revisions.length > 0 && (
                <section>
                  <h3 className="text-sm font-black text-prism-text">Earlier versions</h3>
                  <ul className="mt-2 divide-y divide-prism-border/60 rounded-2xl border border-prism-border/70">
                    {detail.revisions.map((revision) => (
                      <li key={revision.revision_id} className="flex items-start justify-between gap-3 p-3">
                        <div>
                          <p className="font-bold text-prism-text">Revision {revision.revision_no} · {formatMoney(revision.price)}{revision.weight ? ` · ${revision.weight}` : ""}{revision.reference_fixed ? ` · previous ${formatMoney(revision.previous_price)} (fixed)` : ""}</p>
                          {revision.reason_for_change && <p className="text-prism-muted">“{revision.reason_for_change}”</p>}
                        </div>
                        <p className="shrink-0 text-[10px] text-prism-muted">{formatDateTime(revision.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        {onDecide && quote && (
          <footer className="grid grid-cols-2 gap-3 border-t border-prism-border/70 px-5 py-4">
            <button type="button" onClick={() => onDecide("REJECTED")} className="rounded-full bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Reject</button>
            <button type="button" onClick={() => onDecide("APPROVED")} className="rounded-full bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">{approveLabel}</button>
          </footer>
        )}
      </aside>
    </div>
  );
}

// Original reference next to what the reader fixed. The frozen reference is
// unchanged; the fix lives on this price only.
function ReferenceFixSection({ quote }: { quote: ReviewQuote }) {
  const rows: [string, string, string][] = [];
  if (quote.original_previous_price !== null) rows.push(["Previous price", formatMoney(quote.original_previous_price), formatMoney(quote.previous_price)]);
  if (quote.original_previous_weight !== null) rows.push(["Previous weight", quote.original_previous_weight, quote.previous_weight || "—"]);
  const text = (value: string | null) => value || "—";
  if ((quote.uom_standard || null) !== (quote.baseline_uom_standard || null)) rows.push(["Standard unit", text(quote.baseline_uom_standard), text(quote.uom_standard)]);
  if ((quote.uom_local || null) !== (quote.baseline_uom_local || null)) rows.push(["Local unit", text(quote.baseline_uom_local), text(quote.uom_local)]);
  if ((quote.brand || null) !== (quote.baseline_brand || null)) rows.push(["Brand", text(quote.baseline_brand), text(quote.brand)]);
  if ((quote.description || null) !== (quote.baseline_description || null)) rows.push(["Description", text(quote.baseline_description), text(quote.description)]);
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-black text-amber-900">Reference fixed by the reader</h3>
      {quote.reference_fix_reason && <p className="mt-1 italic text-amber-900">“{quote.reference_fix_reason}”</p>}
      <table className="mt-3 w-full text-left">
        <thead className="text-[10px] uppercase tracking-[0.1em] text-amber-800">
          <tr><th className="pb-1 pr-2 font-bold">Field</th><th className="pb-1 pr-2 font-bold">Reference</th><th className="pb-1 font-bold">Fixed to</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after]) => (
            <tr key={label} className="border-t border-amber-200 align-top">
              <td className="py-1.5 pr-2 font-semibold text-amber-900">{label}</td>
              <td className="py-1.5 pr-2 text-prism-muted line-through">{before}</td>
              <td className="py-1.5 font-bold text-prism-text">{after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-amber-800">Price and weight changes are measured against the fixed previous values.</p>
    </section>
  );
}
