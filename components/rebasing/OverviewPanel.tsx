"use client";

import { useState } from "react";
import type { DashboardUser } from "@/lib/auth";
import { MetricRow, ReaderMetricRow, number, percent } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

type GroupBy = "region" | "market" | "reader";
type ProgressResponse<T> = { rows: T[]; scope: "NATIONAL" | "REGION" | "MARKETS" };

const ZERO: MetricRow = {
  original_target: 0, completed_outlets: 0, approved_outlet_carryforward: 0, incoming_carryforward: 0,
  operational_workload: 0, accounted_outlets: 0, quotes_submitted: 0, pending_supervisor: 0, pending_rs: 0,
  pending_hq: 0, rejected: 0, final_approved: 0, not_available: 0, carryover_pending: 0, carryover_obligations: 0,
  duplicate_attempts: 0, assignment_overrides: 0, gps_outlets_checked: 0, gps_outlets_far: 0, gps_outlets_no_reference: 0,
  reference_fixes: 0,
};

function tone(value: number) {
  return value < 50 ? "bg-red-100 text-red-700" : value < 80 ? "bg-yellow-100 text-yellow-800" : value < 100 ? "bg-emerald-100 text-emerald-800" : "bg-emerald-600 text-white";
}

function Indicator({ label, value, hint, accent, pct, action }: {
  label: string;
  value: number;
  hint: string;
  accent: "purple" | "teal" | "pink" | "rose" | "amber";
  pct?: number;
  action?: { label: string; onClick: () => void };
}) {
  const bar = { purple: "bg-prism-purple", teal: "bg-prism-teal", pink: "bg-prism-pink", rose: "bg-rose-500", amber: "bg-amber-400" }[accent];
  return (
    <article className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      <span className={`absolute left-0 top-0 h-full w-1.5 ${bar}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-prism-muted sm:text-[11px]">{label}</p>
        {pct !== undefined && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${tone(pct)}`}>{pct.toFixed(0)}%</span>}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:mt-3 sm:text-3xl">{number.format(value)}</p>
      <p className="mt-1 text-[11px] leading-snug text-prism-muted sm:text-xs">{hint}</p>
      {pct !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-prism-bg">
          <div className={`h-full rounded-full ${pct < 50 ? "bg-red-500" : pct < 80 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {action && (
        <button type="button" onClick={action.onClick} className="mt-3 rounded-full bg-prism-bg px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-prism-purple transition hover:bg-prism-purple hover:text-white">
          {action.label}
        </button>
      )}
    </article>
  );
}

function Pipeline({ totals }: { totals: MetricRow }) {
  const stages = [
    { label: "Supervisor", value: totals.pending_supervisor, color: "bg-amber-400" },
    { label: "Regional", value: totals.pending_rs, color: "bg-sky-500" },
    { label: "HQ", value: totals.pending_hq, color: "bg-prism-purple" },
    { label: "Final approved", value: totals.final_approved, color: "bg-emerald-500" },
    { label: "Rejected", value: totals.rejected, color: "bg-rose-500" },
  ];
  const total = Math.max(totals.quotes_submitted, 1);
  return (
    <section className="rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-prism-text">Price approval pipeline</h2>
          <p className="mt-1 text-xs text-prism-muted">Supervisor → Regional Statistician → HQ. Only final-approved prices count as official.</p>
        </div>
        <p className="text-xs font-bold text-prism-muted">{number.format(totals.quotes_submitted)} prices submitted</p>
      </div>
      <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-prism-bg" role="img" aria-label="Prices by review stage">
        {stages.map((stage) => stage.value > 0 && (
          <div key={stage.label} className={stage.color} style={{ width: `${(stage.value / total) * 100}%` }} title={`${stage.label}: ${stage.value}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stages.map((stage) => (
          <li key={stage.label} className="rounded-2xl bg-prism-bg/70 px-3 py-2.5">
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} /><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-prism-muted">{stage.label}</span></div>
            <p className="mt-1 text-lg font-black text-prism-text">{number.format(stage.value)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewPanel({ periodId, weekId, role, onOpenReviews, onOpenCarryovers }: {
  periodId: string;
  weekId: string | null;
  role: DashboardUser["role"];
  onOpenReviews: () => void;
  onOpenCarryovers: () => void;
}) {
  const isNational = role === "HQ" || role === "ADMIN";
  const [groupBy, setGroupBy] = useState<GroupBy>(isNational ? "region" : "market");
  const weekQuery = weekId ? `&weekId=${weekId}` : "";
  const national = useRebasingQuery<ProgressResponse<MetricRow>>(`/progress?periodId=${periodId}&groupBy=national${weekQuery}`);
  const breakdown = useRebasingQuery<ProgressResponse<MetricRow | ReaderMetricRow>>(`/progress?periodId=${periodId}&groupBy=${groupBy}${weekQuery}`);
  const totals = national.data ? national.data.rows[0] || ZERO : null;
  const rows = breakdown.data?.rows || [];
  const loading = national.loading;
  const breakdownLoading = breakdown.loading;
  const error = national.error || breakdown.error;

  if (loading && !totals) return <div className="mt-6 rounded-3xl bg-white p-10 text-center text-sm text-prism-muted shadow-sm">Loading Market Reading indicators…</div>;
  if (error && !totals) return <div role="alert" className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!totals) return null;

  const awaitingMe = role === "SUPERVISOR" ? totals.pending_supervisor : role === "REGIONAL_STATISTICIAN" ? totals.pending_rs : totals.pending_hq;
  const inReview = totals.pending_supervisor + totals.pending_rs + totals.pending_hq;
  const groupings: GroupBy[] = isNational ? ["region", "market", "reader"] : ["market", "reader"];

  return (
    <div className={`mt-6 space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicator label="Outlets completed" value={totals.completed_outlets} accent="teal" pct={percent(totals.completed_outlets, totals.original_target)} hint={`of ${number.format(totals.original_target)} planned${weekId ? " this week" : ""}`} />
        <Indicator label="Accounted for" value={totals.accounted_outlets} accent="purple" pct={percent(totals.accounted_outlets, totals.operational_workload)} hint={`${number.format(totals.approved_outlet_carryforward)} carried out · workload ${number.format(totals.operational_workload)}`} />
        <Indicator label="Prices submitted" value={totals.quotes_submitted} accent="pink" hint={`${number.format(totals.not_available)} products not available this month`} />
        <Indicator label="Final approved" value={totals.final_approved} accent="teal" pct={percent(totals.final_approved, totals.quotes_submitted)} hint="Official prices (HQ approved)" />
        <Indicator label="Awaiting your review" value={awaitingMe} accent="amber" hint={`${number.format(inReview)} in review across all stages`} action={awaitingMe > 0 ? { label: "Review prices", onClick: onOpenReviews } : undefined} />
        <Indicator label="Rejected prices" value={totals.rejected} accent="rose" hint="Returned to readers for correction" />
        <Indicator label="Carry-forward" value={totals.carryover_pending} accent="amber" hint={`pending review · ${number.format(totals.carryover_obligations)} approved obligations`} action={{ label: "Open carry-forward", onClick: onOpenCarryovers }} />
        <Indicator label="Data quality" value={totals.gps_outlets_far} accent="rose" hint={`outlets flagged far by GPS · ${number.format(totals.duplicate_attempts)} duplicate attempts · ${number.format(totals.assignment_overrides)} overrides · ${number.format(totals.reference_fixes)} reference fixes`} />
      </section>

      <Pipeline totals={totals} />

      <section className="rounded-3xl border border-prism-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-prism-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-prism-text">Progress by {groupBy}</h2>
            <p className="mt-1 text-xs text-prism-muted">Outlet completion counts distinct completed outlets, not prices.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {groupings.map((item) => (
              <button key={item} type="button" onClick={() => setGroupBy(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold capitalize transition ${groupBy === item ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted hover:text-prism-text"}`}>
                {item}s
              </button>
            ))}
          </div>
        </div>
        <div className={breakdownLoading ? "opacity-60" : ""}>
          {groupBy === "reader"
            ? <ReaderBreakdown rows={rows as ReaderMetricRow[]} />
            : <AreaBreakdown rows={rows as MetricRow[]} groupBy={groupBy} />}
          {!breakdownLoading && rows.length === 0 && <p className="px-5 py-10 text-center text-xs text-prism-muted">No records for this selection.</p>}
        </div>
      </section>
    </div>
  );
}

function AreaBreakdown({ rows, groupBy }: { rows: MetricRow[]; groupBy: "region" | "market" }) {
  const sorted = [...rows].sort((a, b) => percent(a.accounted_outlets, a.operational_workload) - percent(b.accounted_outlets, b.operational_workload));
  const name = (row: MetricRow) => (groupBy === "region" ? row.region_name : row.market_name) || "—";
  return (
    <>
      {/* Phone: cards */}
      <ul className="divide-y divide-prism-border/60 md:hidden">
        {sorted.map((row) => {
          const pct = percent(row.accounted_outlets, row.operational_workload);
          return (
            <li key={(groupBy === "region" ? row.region_id : row.market_id) || name(row)} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-prism-text">{name(row)}</p>
                  {groupBy === "market" && <p className="text-[11px] text-prism-muted">{row.region_name}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${tone(pct)}`}>{pct.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-prism-bg"><div className="h-full rounded-full bg-gradient-to-r from-prism-teal to-prism-purple" style={{ width: `${pct}%` }} /></div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div><dt className="text-prism-muted">Outlets</dt><dd className="font-black text-prism-text">{row.completed_outlets}/{row.operational_workload}</dd></div>
                <div><dt className="text-prism-muted">Prices</dt><dd className="font-black text-prism-text">{number.format(row.quotes_submitted)}</dd></div>
                <div><dt className="text-prism-muted">In review</dt><dd className="font-black text-prism-text">{number.format(row.pending_supervisor + row.pending_rs + row.pending_hq)}</dd></div>
                <div><dt className="text-prism-muted">Final</dt><dd className="font-black text-emerald-700">{number.format(row.final_approved)}</dd></div>
                <div><dt className="text-prism-muted">Rejected</dt><dd className="font-black text-rose-600">{number.format(row.rejected)}</dd></div>
                <div><dt className="text-prism-muted">Carry-fwd</dt><dd className="font-black text-prism-text">{number.format(row.carryover_pending)}</dd></div>
              </dl>
            </li>
          );
        })}
      </ul>

      {/* Tablet/desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.14em] text-prism-muted">
            <tr>
              <th className="px-5 py-3">{groupBy}</th>
              <th className="px-3 py-3 text-right">Target</th>
              <th className="px-3 py-3 text-right">Completed</th>
              <th className="px-3 py-3 text-right">Carried out / in</th>
              <th className="px-3 py-3">Accounted</th>
              <th className="px-3 py-3 text-right">Prices</th>
              <th className="px-3 py-3 text-right">Sup / RS / HQ</th>
              <th className="px-3 py-3 text-right">Final</th>
              <th className="px-3 py-3 text-right">Rejected</th>
              <th className="px-3 py-3 text-right">N/A</th>
              <th className="px-5 py-3 text-right">Carry-fwd pending</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const pct = percent(row.accounted_outlets, row.operational_workload);
              return (
                <tr key={(groupBy === "region" ? row.region_id : row.market_id) || name(row)} className="border-t border-prism-border/60 hover:bg-slate-50/70">
                  <td className="px-5 py-3.5"><p className="font-bold text-prism-text">{name(row)}</p>{groupBy === "market" && <p className="text-[10px] text-prism-muted">{row.region_name}</p>}{groupBy === "region" && <p className="text-[10px] text-prism-muted">{row.markets} markets</p>}</td>
                  <td className="px-3 py-3.5 text-right text-prism-muted">{number.format(row.original_target)}</td>
                  <td className="px-3 py-3.5 text-right font-black text-prism-text">{number.format(row.completed_outlets)}</td>
                  <td className="px-3 py-3.5 text-right text-prism-muted">{row.approved_outlet_carryforward} / {row.incoming_carryforward}</td>
                  <td className="px-3 py-3.5"><span className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 text-[10px] font-black ${tone(pct)}`}>{pct.toFixed(0)}%</span></td>
                  <td className="px-3 py-3.5 text-right font-bold text-prism-purple">{number.format(row.quotes_submitted)}</td>
                  <td className="px-3 py-3.5 text-right text-prism-text">{row.pending_supervisor} / {row.pending_rs} / {row.pending_hq}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-emerald-700">{number.format(row.final_approved)}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-rose-600">{number.format(row.rejected)}</td>
                  <td className="px-3 py-3.5 text-right text-prism-muted">{number.format(row.not_available)}</td>
                  <td className="px-5 py-3.5 text-right text-prism-text">{number.format(row.carryover_pending)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ReaderBreakdown({ rows }: { rows: ReaderMetricRow[] }) {
  return (
    <>
      <ul className="divide-y divide-prism-border/60 md:hidden">
        {rows.map((row) => (
          <li key={`${row.reader_id}-${row.market_name}`} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-prism-text">{row.reader_name}</p>
                <p className="text-[11px] text-prism-muted">{row.market_name} · {row.region_name}</p>
              </div>
              {row.assignment_status !== "ACTIVE" && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-prism-muted">{row.assignment_status}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><dt className="text-prism-muted">Outlets</dt><dd className="font-black text-prism-text">{row.outlets_completed}</dd></div>
              <div><dt className="text-prism-muted">Prices</dt><dd className="font-black text-prism-text">{row.quotes_submitted}</dd></div>
              <div><dt className="text-prism-muted">Final</dt><dd className="font-black text-emerald-700">{row.final_approved}</dd></div>
              <div><dt className="text-prism-muted">Rejected</dt><dd className="font-black text-rose-600">{row.rejected}</dd></div>
              <div><dt className="text-prism-muted">N/A</dt><dd className="font-black text-prism-text">{row.not_available}</dd></div>
              <div><dt className="text-prism-muted">GPS far</dt><dd className="font-black text-prism-text">{row.gps_outlets_far}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.14em] text-prism-muted">
            <tr>
              <th className="px-5 py-3">Reader</th>
              <th className="px-3 py-3">Market</th>
              <th className="px-3 py-3 text-right">Outlets</th>
              <th className="px-3 py-3 text-right">Prices</th>
              <th className="px-3 py-3 text-right">Final</th>
              <th className="px-3 py-3 text-right">Rejected</th>
              <th className="px-3 py-3 text-right">N/A</th>
              <th className="px-3 py-3 text-right">Duplicates</th>
              <th className="px-5 py-3 text-right">GPS far</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.reader_id}-${row.market_name}`} className="border-t border-prism-border/60 hover:bg-slate-50/70">
                <td className="px-5 py-3.5"><p className="font-bold text-prism-text">{row.reader_name}</p>{row.assignment_status !== "ACTIVE" && <p className="text-[10px] text-prism-muted">{row.assignment_status}</p>}</td>
                <td className="px-3 py-3.5 text-prism-muted">{row.market_name} · {row.region_name}</td>
                <td className="px-3 py-3.5 text-right font-black text-prism-text">{row.outlets_completed}</td>
                <td className="px-3 py-3.5 text-right font-bold text-prism-purple">{row.quotes_submitted}</td>
                <td className="px-3 py-3.5 text-right font-bold text-emerald-700">{row.final_approved}</td>
                <td className="px-3 py-3.5 text-right font-bold text-rose-600">{row.rejected}</td>
                <td className="px-3 py-3.5 text-right text-prism-muted">{row.not_available}</td>
                <td className="px-3 py-3.5 text-right text-prism-muted">{row.duplicate_attempts}</td>
                <td className="px-5 py-3.5 text-right text-prism-muted">{row.gps_outlets_far}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
