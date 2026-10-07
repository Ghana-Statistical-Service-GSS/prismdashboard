"use client";

import { useState } from "react";
import type { DashboardUser } from "@/lib/auth";
import { Decision, DecisionDialog } from "./DecisionDialog";
import { Carryover, RebasingApiError, formatDateTime, rebasingApi } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

type Filter = "" | Carryover["status"];
type ListResponse = { carryovers: Carryover[]; queue: "SUPERVISOR" | "RS" | null };

const STATUS_STYLE: Record<Carryover["status"], string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-600 text-white",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-prism-muted",
};

// Reader -> Supervisor -> RS. Only the RS approval turns a request into a
// target-week obligation on the phone; HQ/Admin can monitor but not decide.
function reviewStage(role: DashboardUser["role"], row: Carryover): "supervisor-review" | "rs-review" | null {
  if (row.status !== "PENDING") return null;
  if (role === "SUPERVISOR" && row.supervisor_status === "PENDING") return "supervisor-review";
  if (role === "REGIONAL_STATISTICIAN" && row.supervisor_status === "APPROVED" && row.rs_status === "PENDING") return "rs-review";
  return null;
}

function scopeLabel(row: Carryover) {
  if (row.scope_type === "OUTLET") return "Whole outlet";
  if (row.scope_type === "ITEM") return `Item · ${row.item_name || "—"}`;
  return `Product · ${row.product_name || "—"}${row.item_name ? ` (${row.item_name})` : ""}`;
}

export function CarryForwardPanel({ periodId, role, onChanged }: { periodId: string; role: DashboardUser["role"]; onChanged: () => void }) {
  const reviewer = role === "SUPERVISOR" || role === "REGIONAL_STATISTICIAN";
  const [filter, setFilter] = useState<Filter>("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<{ row: Carryover; decision: Decision; stage: "supervisor-review" | "rs-review" } | null>(null);
  const params = new URLSearchParams({ periodId });
  if (filter) params.set("status", filter);
  const list = useRebasingQuery<ListResponse>(`/carryovers?${params}`, reloadKey);
  const rows = list.data?.carryovers || [];
  const { loading, error } = list;

  const decide = async (text: string) => {
    if (!pending) return;
    const { row, decision, stage } = pending;
    try {
      await rebasingApi(`/carryovers/${row.carryover_id}/${stage}`, { method: "POST", body: { decision, ...(text ? { comment: text } : {}) } });
    } catch (reason) {
      if (reason instanceof RebasingApiError && reason.status === 409) setReloadKey((key) => key + 1);
      throw reason;
    }
    setPending(null);
    setNotice(
      decision === "REJECTED"
        ? `Carry-forward for ${row.outlet_name} rejected.`
        : stage === "supervisor-review"
          ? `Carry-forward for ${row.outlet_name} approved and sent to the Regional Statistician.`
          : `Carry-forward for ${row.outlet_name} approved. It now appears in Week ${row.target_week_no} on the reader's phone.`
    );
    setReloadKey((key) => key + 1);
    onChanged();
  };

  const filters: { value: Filter; label: string }[] = [
    { value: "", label: reviewer ? "Awaiting my review" : "All" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "COMPLETED", label: "Completed" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CANCELLED", label: "Withdrawn" },
  ];

  return (
    <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="border-b border-prism-border/70 p-5">
        <h2 className="text-base font-black text-prism-text">Carry-forward requests</h2>
        <p className="mt-1 max-w-2xl text-xs text-prism-muted">
          {role === "SUPERVISOR"
            ? "Readers asking to move unfinished outlet, item or product work to a later week. Your approval sends the request to the Regional Statistician."
            : role === "REGIONAL_STATISTICIAN"
              ? "Requests already approved by Supervisors. Your approval makes the work an obligation in the target week."
              : "Monitoring view. Supervisors and Regional Statisticians decide carry-forward requests."}
        </p>
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {filters.map((item) => (
            <button key={item.label} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${filter === item.value ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted hover:text-prism-text"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p role="status" className="mx-5 mt-4 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{error}</p>}

      <div className={`grid gap-4 p-4 sm:p-5 xl:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
        {rows.map((row) => {
          const stage = reviewStage(role, row);
          return (
            <article key={row.carryover_id} className="flex flex-col rounded-2xl border border-prism-border/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-prism-text">{row.outlet_name}</p>
                  <p className="truncate text-[11px] text-prism-muted">{row.market_name}{row.outlet_code ? ` · ${row.outlet_code}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_STYLE[row.status]}`}>{row.status === "CANCELLED" ? "WITHDRAWN" : row.status}</span>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-prism-bg/70 p-3">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-prism-purple ring-1 ring-prism-border">Week {row.source_week_no}</span>
                <span aria-hidden="true" className="text-prism-muted">→</span>
                <span className="rounded-full bg-prism-purple px-2.5 py-1 text-xs font-black text-white">Week {row.target_week_no}</span>
                <span className="ml-auto truncate text-[11px] font-semibold text-prism-text">{scopeLabel(row)}</span>
              </div>

              <p className="mt-3 text-xs italic text-prism-text">“{row.reason}”</p>
              <p className="mt-1 text-[11px] text-prism-muted">Requested by {row.requested_by_name} · {formatDateTime(row.requested_at)}</p>

              <ol className="mt-3 space-y-1 text-[11px]">
                <li><span className="text-prism-muted">Supervisor:</span> <strong className={row.supervisor_status === "REJECTED" ? "text-rose-700" : "text-prism-text"}>{row.supervisor_status || "—"}</strong>{row.supervisor_at ? ` · ${formatDateTime(row.supervisor_at)}` : ""}{row.supervisor_comment ? ` · “${row.supervisor_comment}”` : ""}</li>
                <li><span className="text-prism-muted">Regional:</span> <strong className={row.rs_status === "REJECTED" ? "text-rose-700" : "text-prism-text"}>{row.rs_status || (row.supervisor_status === "PENDING" ? "Waiting for Supervisor" : "—")}</strong>{row.rs_at ? ` · ${formatDateTime(row.rs_at)}` : ""}{row.rs_comment ? ` · “${row.rs_comment}”` : ""}</li>
              </ol>

              {stage && (
                <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                  <button type="button" onClick={() => setPending({ row, decision: "REJECTED", stage })} className="rounded-full bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Reject</button>
                  <button type="button" onClick={() => setPending({ row, decision: "APPROVED", stage })} className="rounded-full bg-teal-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-teal-700">Approve</button>
                </div>
              )}
            </article>
          );
        })}
        {!loading && rows.length === 0 && !error && (
          <p className="col-span-full py-10 text-center text-sm text-prism-muted">{filter === "" && reviewer ? "No carry-forward requests are waiting for you." : "No carry-forward requests in this view."}</p>
        )}
      </div>

      {pending && (
        <DecisionDialog
          decision={pending.decision}
          title={`${pending.row.outlet_name} · Week ${pending.row.source_week_no} → ${pending.row.target_week_no}`}
          summary={
            <div className="space-y-1">
              <p><strong>{scopeLabel(pending.row)}</strong> · {pending.row.market_name}</p>
              <p className="italic">“{pending.row.reason}”</p>
              <p className="text-prism-muted">{pending.stage === "supervisor-review" ? "Approval forwards this to the Regional Statistician." : "Approval creates the obligation in the target week."}</p>
            </div>
          }
          onSubmit={decide}
          onClose={() => setPending(null)}
        />
      )}
    </section>
  );
}
