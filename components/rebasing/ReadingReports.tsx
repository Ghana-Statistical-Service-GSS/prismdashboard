"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { MetricRow, Period, ReaderMetricRow, formatDay, number, percent, periodLabel } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

// Market Reading › Reports. Summaries for the month at the caller's scope
// (Supervisor: own markets, RS: region, HQ: national), each table exportable.

type Summary = {
  turnaround: { stage: "SUPERVISOR" | "RS" | "HQ"; decisions: number; rejected: number; avg_hours: number | null; median_hours: number | null }[];
  waiting: { stage: "PENDING_SUPERVISOR" | "PENDING_RS" | "PENDING_HQ"; under_1_day: number; one_to_3_days: number; over_3_days: number }[];
  completeness: { region_id: string; region_name: string; expected: number; priced: number; not_available: number; carried: number; open: number }[];
  daily: { day: string; submitted: number; final_approved: number; rejected: number }[];
  late: { prices_synced_late: number; prices_time_corrected: number; auto_approved: number; auto_approved_flagged: number };
  auto_approved_flagged: { quote_id: string; market_name: string; region_name: string; outlet_name: string; product_name: string; price: string; previous_price: string | null; price_change_pct: string | null; weight_change_pct: string | null; reason_for_change: string | null }[];
  exceptions: { reason_category: string; exceptions: number; products: number }[];
  readers: { reader_id: string; reader_name: string; market_name: string; region_name: string; weeks: { week_no: number; completed: number; share: number | null; ended: boolean }[]; weeks_missed: number; synced_late: number; time_corrected: number }[];
};
const REASON_LABEL: Record<string, string> = { READER_ABSENT: "Reader absent", OUTLET_CLOSED: "Outlet closed", ACCESS_INSECURITY: "Access or insecurity", OTHER: "Other" };
type GpsRow = { check_id: string; result: string; distance_m: number | null; region_name: string; market_name: string; outlet_name: string; reader_name: string; week_no: number | null; attempts: number };

const COLORS = { priced: "#14b8a6", not_available: "#94a3b8", carried: "#7c3aed", open: "#f59e0b", submitted: "#7c3aed", approved: "#14b8a6", rejected: "#f43f5e" };
const STAGES = [
  { key: "SUPERVISOR", pending: "PENDING_SUPERVISOR", label: "Supervisor" },
  { key: "RS", pending: "PENDING_RS", label: "Regional Statistician" },
  { key: "HQ", pending: "PENDING_HQ", label: "HQ" },
] as const;

const hours = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value < 24 ? `${value.toFixed(1)} h` : `${(value / 24).toFixed(1)} days`;

// CSV download of a table, as shown.
function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const blob = new Blob([[header, ...rows].map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReadingReports() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  useEffect(() => { loadDashboardUser().then(setUser).catch(() => {}); }, []);
  const periods = useRebasingQuery<{ periods: Period[] }>("/periods");
  const list = useMemo(() => (periods.data?.periods || []).filter((p) => p.status !== "UPCOMING")
    .sort((a, b) => b.observation_month.localeCompare(a.observation_month) || a.period_type.localeCompare(b.period_type)), [periods.data]);
  const selectedId = periodId ?? list.find((p) => p.status === "OPEN" && p.period_type === "NORMAL")?.period_id ?? list[0]?.period_id ?? null;
  const period = list.find((p) => p.period_id === selectedId) || null;
  const q = (path: string) => (selectedId ? `${path}${path.includes("?") ? "&" : "?"}periodId=${selectedId}` : null);

  const national = useRebasingQuery<{ rows: MetricRow[] }>(q("/progress?groupBy=national"));
  const regions = useRebasingQuery<{ rows: MetricRow[] }>(q("/progress?groupBy=region"));
  const markets = useRebasingQuery<{ rows: MetricRow[] }>(q("/progress?groupBy=market"));
  const readers = useRebasingQuery<{ rows: ReaderMetricRow[] }>(q("/progress?groupBy=reader"));
  const summary = useRebasingQuery<Summary>(q("/reports/summary"));
  const gps = useRebasingQuery<{ rows: GpsRow[] }>(q("/gps-checks?result=FLAGGED"));

  const totals = national.data?.rows[0];
  const scopeText = user?.role === "SUPERVISOR" ? "your markets" : user?.role === "REGIONAL_STATISTICIAN" ? (user.region_name || "your region") : "all regions";
  const error = periods.error || national.error || summary.error;
  const file = (name: string) => `market-reading-${period ? period.observation_month.slice(0, 7) : "period"}-${name}.csv`;

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Reading</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:text-3xl">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-prism-muted">{`Collection, review and data completeness for ${scopeText}. Every table can be downloaded as CSV.`}</p>
        </div>
        {list.length > 0 && (
          <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-prism-text shadow-sm">
            Month
            <select value={selectedId ?? ""} onChange={(e) => setPeriodId(e.target.value)} className="bg-transparent text-sm font-black outline-none">
              {list.map((p) => <option key={p.period_id} value={p.period_id}>{`${periodLabel(p)}${p.status === "CLOSED" ? " (closed)" : ""}`}</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {periods.data && list.length === 0 && <Panel title="No collection month yet"><p className="text-sm text-prism-muted">Reports appear once HQ opens a month.</p></Panel>}

      {totals && (
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Outlets accounted" value={`${percent(totals.accounted_outlets, totals.operational_workload).toFixed(0)}%`} hint={`${number.format(totals.accounted_outlets)} of ${number.format(totals.operational_workload)}`} tone="teal" />
          <Kpi label="Prices submitted" value={number.format(totals.quotes_submitted)} hint={`${number.format(totals.not_available)} not available`} tone="purple" />
          <Kpi label="Final approved" value={`${percent(totals.final_approved, totals.quotes_submitted).toFixed(0)}%`} hint={`${number.format(totals.final_approved)} prices`} tone="green" />
          <Kpi label="Waiting for review" value={number.format(totals.pending_supervisor + totals.pending_rs + totals.pending_hq)} hint={`${number.format(totals.rejected)} with readers after rejection`} tone={totals.pending_supervisor + totals.pending_rs + totals.pending_hq > 0 ? "amber" : "slate"} />
          <Kpi label="Carry-forwards" value={number.format(totals.carryover_pending + totals.carryover_obligations)} hint={`${number.format(totals.carryover_pending)} awaiting approval`} tone="purple" />
          <Kpi label="Outlets away from GPS" value={number.format(totals.gps_outlets_far)} hint={`${number.format(totals.gps_outlets_no_reference)} with no reference location`} tone={totals.gps_outlets_far ? "rose" : "slate"} />
          <Kpi label="Reference fixes" value={number.format(totals.reference_fixes)} hint="Prices where the reader corrected the reference" tone="slate" />
          <Kpi label="Duplicate attempts" value={number.format(totals.duplicate_attempts)} hint="Same product priced twice at one outlet" tone="slate" />
          {summary.data && (
            <>
              <Kpi label="Synced late" value={number.format(summary.data.late.prices_synced_late)} hint={`${number.format(summary.data.late.prices_time_corrected)} with a corrected phone time`} tone={summary.data.late.prices_synced_late ? "amber" : "slate"} />
              <Kpi label="Auto-approved" value={number.format(summary.data.late.auto_approved)} hint={`${number.format(summary.data.late.auto_approved_flagged)} of them flagged for a large change`} tone={summary.data.late.auto_approved_flagged ? "rose" : "slate"} />
              <Kpi label="Not collected" value={number.format(totals.not_collected ?? 0)} hint="Recorded by HQ / RS with a reason" tone={(totals.not_collected ?? 0) ? "rose" : "slate"} />
            </>
          )}
        </section>
      )}

      {summary.data && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel
            title="Product completeness by region"
            hint="Every expected product ends priced or not available; carried and open products are still to do."
            action={<CsvButton onClick={() => downloadCsv(file("completeness"), ["Region", "Expected", "Priced", "Not available", "Carried forward", "Open"],
              summary.data!.completeness.map((r) => [r.region_name, r.expected, r.priced, r.not_available, r.carried, r.open]))} />}
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.data.completeness} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="region_name" width={96} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="priced" name="Priced" stackId="a" fill={COLORS.priced} />
                  <Bar dataKey="not_available" name="Not available" stackId="a" fill={COLORS.not_available} />
                  <Bar dataKey="carried" name="Carried forward" stackId="a" fill={COLORS.carried} />
                  <Bar dataKey="open" name="Open" stackId="a" fill={COLORS.open} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Prices submitted per day" hint="Ghana date the price reached the server; how many of those are now final approved or rejected.">
            {summary.data.daily.length === 0 ? <p className="text-sm text-prism-muted">No prices yet.</p> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.data.daily.map((d) => ({ ...d, label: formatDay(d.day) }))} margin={{ left: -12, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="submitted" name="Submitted" fill={COLORS.submitted} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="final_approved" name="Final approved" fill={COLORS.approved} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="rejected" name="Rejected" fill={COLORS.rejected} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      )}

      {summary.data && (
        <Panel title="Review pipeline" hint="How long prices wait at each stage, and what is waiting now.">
          <div className="grid gap-3 md:grid-cols-3">
            {STAGES.map((stage) => {
              const t = summary.data!.turnaround.find((row) => row.stage === stage.key);
              const w = summary.data!.waiting.find((row) => row.stage === stage.pending);
              const waitingNow = w ? w.under_1_day + w.one_to_3_days + w.over_3_days : 0;
              return (
                <div key={stage.key} className="rounded-2xl border border-prism-border/70 p-4">
                  <p className="text-sm font-black text-prism-text">{stage.label}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-prism-muted">Typical wait</dt><dd className="text-lg font-black text-prism-text">{hours(t?.median_hours)}</dd></div>
                    <div><dt className="text-prism-muted">Average</dt><dd className="text-lg font-black text-prism-text">{hours(t?.avg_hours)}</dd></div>
                    <div><dt className="text-prism-muted">Decided</dt><dd className="font-bold text-prism-text">{`${number.format(t?.decisions ?? 0)} (${number.format(t?.rejected ?? 0)} rejected)`}</dd></div>
                    <div><dt className="text-prism-muted">Waiting now</dt><dd className="font-bold text-prism-text">{number.format(waitingNow)}</dd></div>
                  </dl>
                  {waitingNow > 0 && w && (
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-prism-bg" title="Under 1 day · 1–3 days · over 3 days">
                      <div className="bg-emerald-400" style={{ width: `${(w.under_1_day / waitingNow) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(w.one_to_3_days / waitingNow) * 100}%` }} />
                      <div className="bg-rose-500" style={{ width: `${(w.over_3_days / waitingNow) * 100}%` }} />
                    </div>
                  )}
                  {w && w.over_3_days > 0 && <p className="mt-2 text-[11px] font-bold text-rose-700">{`${w.over_3_days} waiting more than 3 days`}</p>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {user?.role !== "SUPERVISOR" && regions.data && regions.data.rows.length > 0 && (
        <MetricTable title="By region" rows={regions.data.rows} nameKey="region_name" nameLabel="Region" file={file("regions")} />
      )}
      {markets.data && <MetricTable title="By market" rows={markets.data.rows} nameKey="market_name" nameLabel="Market" file={file("markets")} searchable />}

      {summary.data && summary.data.readers.length > 0 && (
        <Panel
          title="Reader accountability"
          hint="Outlets each reader completed per week against their share (the market's weekly target split equally among its readers), weeks missed and records synced late."
          action={<CsvButton onClick={() => downloadCsv(file("reader-accountability"),
            ["Reader", "Market", "Region", ...summary.data!.readers[0].weeks.map((w) => `Week ${w.week_no} done / share`), "Weeks missed", "Synced late", "Time corrected"],
            summary.data!.readers.map((r) => [r.reader_name, r.market_name, r.region_name, ...r.weeks.map((w) => `${w.completed} / ${w.share ?? "-"}`), r.weeks_missed, r.synced_late, r.time_corrected]))} />}
        >
          <Table
            header={["Reader", "Market", ...summary.data.readers[0].weeks.map((w) => `Week ${w.week_no}`), "Missed", "Late"]}
            rows={[...summary.data.readers].sort((a, b) => b.weeks_missed - a.weeks_missed || b.synced_late - a.synced_late).map((r) => [
              <span key="n" className="font-bold text-prism-text">{r.reader_name}</span>,
              r.market_name,
              ...r.weeks.map((w) => (
                <span key={w.week_no} className={clsx(w.ended && w.share !== null && w.completed < w.share ? "font-bold text-rose-700" : w.share !== null && w.completed >= w.share ? "text-emerald-700" : "")}>
                  {`${w.completed} / ${w.share ?? "–"}`}
                </span>
              )),
              <span key="m" className={r.weeks_missed ? "font-bold text-rose-700" : ""}>{r.weeks_missed}</span>,
              <span key="l" className={r.synced_late ? "font-bold text-amber-700" : ""}>{r.synced_late}</span>,
            ])}
          />
        </Panel>
      )}

      {summary.data && summary.data.auto_approved_flagged.length > 0 && (
        <Panel
          title="Auto-approved and flagged"
          hint="Never reviewed before their month closed, approved automatically when the next month opened, and flagged for a large price or weight change. Worth a look."
          action={<CsvButton onClick={() => downloadCsv(file("auto-approved-flagged"), ["Market", "Region", "Outlet", "Product", "Price", "Previous", "Price change %", "Weight change %", "Reader's reason"],
            summary.data!.auto_approved_flagged.map((q) => [q.market_name, q.region_name, q.outlet_name, q.product_name, q.price, q.previous_price, q.price_change_pct, q.weight_change_pct, q.reason_for_change]))} />}
        >
          <Table
            header={["Product", "Outlet", "Price", "Previous", "Change", "Reason"]}
            rows={summary.data.auto_approved_flagged.map((q) => [
              <span key="p" className="font-bold text-prism-text">{q.product_name}</span>, `${q.outlet_name} · ${q.market_name}`,
              q.price, q.previous_price ?? "—",
              <span key="c" className="font-bold text-rose-700">{q.price_change_pct !== null ? `${Number(q.price_change_pct) > 0 ? "+" : ""}${Number(q.price_change_pct).toFixed(1)}%` : q.weight_change_pct !== null ? `weight ${Number(q.weight_change_pct).toFixed(1)}%` : "—"}</span>,
              q.reason_for_change ?? "—",
            ])}
          />
        </Panel>
      )}

      {summary.data && summary.data.exceptions.length > 0 && (
        <Panel title="Not collected" hint="Work HQ or Regional Statisticians recorded as not collected after the last week, by reason.">
          <div className="grid gap-3 sm:grid-cols-4">
            {summary.data.exceptions.map((e) => (
              <div key={e.reason_category} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-rose-800">{REASON_LABEL[e.reason_category] ?? e.reason_category}</p>
                <p className="mt-1 text-2xl font-black text-rose-900">{number.format(e.products)}</p>
                <p className="text-[11px] text-rose-900/80">{`products · ${e.exceptions} record${e.exceptions === 1 ? "" : "s"}`}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {readers.data && readers.data.rows.length > 0 && (
        <Panel
          title="Market Readers"
          hint="What each reader has collected this month."
          action={<CsvButton onClick={() => downloadCsv(file("readers"), ["Reader", "Market", "Region", "Outlets completed", "Prices", "Final approved", "Rejected", "Not available", "Away from GPS"],
            readers.data!.rows.map((r) => [r.reader_name, r.market_name, r.region_name, r.outlets_completed, r.quotes_submitted, r.final_approved, r.rejected, r.not_available, r.gps_outlets_far]))} />}
        >
          <Table
            header={["Reader", "Market", "Outlets", "Prices", "Approved", "Rejected", "Not avail.", "GPS far"]}
            rows={readers.data.rows.map((r) => [
              <span key="n" className="font-bold text-prism-text">{r.reader_name}</span>, r.market_name, r.outlets_completed, r.quotes_submitted, r.final_approved,
              <span key="r" className={r.rejected ? "font-bold text-rose-700" : ""}>{r.rejected}</span>, r.not_available,
              <span key="g" className={r.gps_outlets_far ? "font-bold text-rose-700" : ""}>{r.gps_outlets_far}</span>,
            ])}
          />
        </Panel>
      )}

      {gps.data && gps.data.rows.length > 0 && (
        <Panel
          title="Outlets checked away from their location"
          hint="Latest GPS check per outlet was far from the recorded location, or the outlet has no location to compare with."
          action={<CsvButton onClick={() => downloadCsv(file("gps"), ["Outlet", "Market", "Region", "Reader", "Week", "Result", "Distance (m)", "Attempts"],
            gps.data!.rows.map((r) => [r.outlet_name, r.market_name, r.region_name, r.reader_name, r.week_no, r.result, r.distance_m === null ? null : Math.round(r.distance_m), r.attempts]))} />}
        >
          <Table
            header={["Outlet", "Market", "Reader", "Result", "Distance", "Attempts"]}
            rows={gps.data.rows.slice(0, 50).map((r) => [
              <span key="o" className="font-bold text-prism-text">{r.outlet_name}</span>, r.market_name, r.reader_name,
              <span key="r" className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black", r.result === "FAR" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-prism-muted")}>{r.result === "FAR" ? "Far" : "No reference"}</span>,
              r.distance_m === null ? "—" : r.distance_m >= 1000 ? `${(r.distance_m / 1000).toFixed(1)} km` : `${Math.round(r.distance_m)} m`, r.attempts,
            ])}
          />
          {gps.data.rows.length > 50 && <p className="mt-2 text-xs text-prism-muted">{`Showing 50 of ${gps.data.rows.length}. Download the CSV for all.`}</p>}
        </Panel>
      )}
    </>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "teal" | "purple" | "green" | "amber" | "rose" | "slate" }) {
  const accent = { teal: "bg-prism-teal", purple: "bg-prism-purple", green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-300" }[tone];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm">
      <span className={clsx("absolute inset-y-0 left-0 w-1", accent)} aria-hidden="true" />
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-prism-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-prism-text">{value}</p>
      <p className="mt-0.5 text-[11px] text-prism-muted">{hint}</p>
    </div>
  );
}

function Panel({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black text-prism-text">{title}</h2>
          {hint && <p className="mt-0.5 max-w-2xl text-xs text-prism-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start rounded-full border border-prism-border px-3 py-1.5 text-xs font-bold text-prism-text hover:bg-prism-bg">
      Download CSV
    </button>
  );
}

function Table({ header, rows }: { header: string[]; rows: ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-prism-border/60 text-[10px] uppercase tracking-[0.08em] text-prism-muted">
            {header.map((h, i) => <th key={h} className={clsx("px-3 py-2 font-bold", i > 1 && "text-right")}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-prism-border/40">
          {rows.map((row, r) => (
            <tr key={r} className="hover:bg-prism-bg/50">
              {row.map((cell, i) => <td key={i} className={clsx("px-3 py-2 text-prism-text", i > 1 && "text-right tabular-nums")}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Region or market progress table with sorting by the column that matters most.
function MetricTable({ title, rows, nameKey, nameLabel, file, searchable }: {
  title: string; rows: MetricRow[]; nameKey: "region_name" | "market_name"; nameLabel: string; file: string; searchable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"coverage" | "waiting" | "name">("coverage");
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((r) => !term || String(r[nameKey] || "").toLowerCase().includes(term));
    const coverage = (r: MetricRow) => percent(r.accounted_outlets, r.operational_workload);
    const waiting = (r: MetricRow) => r.pending_supervisor + r.pending_rs + r.pending_hq;
    return [...filtered].sort((a, b) => sort === "name" ? String(a[nameKey]).localeCompare(String(b[nameKey]))
      : sort === "coverage" ? coverage(a) - coverage(b) : waiting(b) - waiting(a));
  }, [rows, search, sort, nameKey]);
  return (
    <Panel
      title={title}
      hint="Lowest coverage first, so the markets that need attention are at the top."
      action={<CsvButton onClick={() => downloadCsv(file, [nameLabel, "Planned outlets", "Accounted", "Coverage %", "Prices", "Pending Supervisor", "Pending RS", "Pending HQ", "Rejected", "Final approved", "Not available", "Carry pending", "GPS far"],
        shown.map((r) => [String(r[nameKey] ?? ""), r.operational_workload, r.accounted_outlets, Math.round(percent(r.accounted_outlets, r.operational_workload)), r.quotes_submitted, r.pending_supervisor, r.pending_rs, r.pending_hq, r.rejected, r.final_approved, r.not_available, r.carryover_pending, r.gps_outlets_far]))} />}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {searchable ? <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${nameLabel.toLowerCase()}`} className="rounded-xl border border-prism-border px-3 py-2 text-sm sm:w-64" /> : <span />}
        <div className="inline-flex rounded-full bg-prism-bg p-1">
          {([["coverage", "Lowest coverage"], ["waiting", "Most waiting"], ["name", "A–Z"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setSort(key)} className={clsx("rounded-full px-3 py-1.5 text-[11px] font-bold", sort === key ? "bg-white text-prism-purple shadow-sm" : "text-prism-muted")}>{label}</button>
          ))}
        </div>
      </div>
      <Table
        header={[nameLabel, "Coverage", "Accounted", "Prices", "Waiting", "Rejected", "Approved", "Not avail."]}
        rows={shown.map((r) => {
          const pct = percent(r.accounted_outlets, r.operational_workload);
          return [
            <span key="n" className="font-bold text-prism-text">{String(r[nameKey] ?? "")}</span>,
            <span key="c" className="inline-flex items-center gap-2">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-prism-bg"><span className={clsx("block h-full rounded-full", pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-prism-teal" : "bg-amber-500")} style={{ width: `${Math.min(100, pct)}%` }} /></span>
              <span className="font-bold">{`${pct.toFixed(0)}%`}</span>
            </span>,
            `${number.format(r.accounted_outlets)} / ${number.format(r.operational_workload)}`,
            number.format(r.quotes_submitted),
            number.format(r.pending_supervisor + r.pending_rs + r.pending_hq),
            number.format(r.rejected),
            number.format(r.final_approved),
            number.format(r.not_available),
          ];
        })}
      />
    </Panel>
  );
}
