"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type Level = "regions" | "districts" | "markets" | "users";

type SubmissionRow = {
  id: string;
  code: string;
  name: string;
  region_id?: string | null;
  region_name?: string | null;
  district_id?: string | null;
  district_name?: string | null;
  market_id?: string | null;
  market_name?: string | null;
  role?: string;
  districts?: number;
  markets?: number;
  outlets: number;
  prices_submitted: number;
  items_priced: number;
  products_priced: number;
  active_readers?: number;
  readers_reporting?: number;
  submitting_users?: number;
  last_submission_at: string | null;
};

type BreakdownMetric = "items" | "products" | "readers";

type RankingRow = {
  id: string;
  code: string;
  name: string;
  item_name?: string;
  prices_submitted: number;
  products_priced?: number;
  markets: number;
  average_price: number | null;
};

type Overview = {
  generated_at: string;
  scope: {
    level: "NATIONAL" | "REGION" | "MARKETS";
    role: "SUPERVISOR" | "REGIONAL_STATISTICIAN" | "HQ" | "ADMIN";
    region_id: string | null;
    region_name: string | null;
    market_ids: string[] | null;
  };
  summary: {
    regions: number;
    districts: number;
    markets: number;
    outlets: number;
    outlets_created: number;
    active_readers: number;
    readers_reporting: number;
    items: number;
    products: number;
    users: number;
    prices_submitted: number;
    items_priced: number;
    products_priced: number;
    last_submission_at: string | null;
  };
  submissions: Record<Level, SubmissionRow[]>;
  rankings: { items: RankingRow[]; products: RankingRow[] };
};

const number = new Intl.NumberFormat("en-GH");

function formatDate(value: string | null) {
  if (!value) return "No submission";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function completionPercentage(completed: number, available: number) {
  return available > 0 ? Math.min((completed / available) * 100, 100) : 0;
}

function MetricCard({ label, value, hint, accent = "purple", percentage, onBreakdown }: {
  label: string;
  value: number;
  hint: string;
  accent?: "purple" | "teal" | "pink";
  percentage?: number;
  onBreakdown?: () => void;
}) {
  const colors = {
    purple: "bg-prism-purple",
    teal: "bg-prism-teal",
    pink: "bg-prism-pink",
  };
  return (
    <article className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
      <span className={`absolute left-0 top-0 h-full w-1.5 ${colors[accent]}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-prism-muted">{label}</p>
        {percentage !== undefined && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${percentage < 50 ? "bg-red-100 text-red-700" : percentage < 80 ? "bg-yellow-100 text-yellow-800" : percentage < 100 ? "bg-emerald-100 text-emerald-800" : "bg-emerald-600 text-white"}`}>
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-prism-text">{number.format(value)}</p>
      <p className="mt-1 text-xs text-prism-muted">{hint}</p>
      {percentage !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-prism-bg">
          <div className={`h-full rounded-full ${percentage < 50 ? "bg-red-500" : percentage < 80 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${percentage}%` }} />
        </div>
      )}
      {onBreakdown && (
        <button type="button" onClick={onBreakdown} className="mt-4 rounded-full bg-prism-bg px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-prism-purple transition hover:bg-prism-purple hover:text-white">
          View breakdown
        </button>
      )}
    </article>
  );
}

function ReaderSubmissionCard({ submitted, active, onBreakdown }: { submitted: number; active: number; onBreakdown: () => void }) {
  const percentage = active > 0 ? Math.min(Math.round((submitted / active) * 100), 100) : 0;
  const status = percentage <= 50
    ? { card: "border-red-700 bg-red-600 text-white", muted: "text-white/80", track: "bg-white/25", fill: "bg-white", label: "Critical" }
    : percentage <= 79
      ? { card: "border-yellow-300 bg-yellow-100 text-yellow-950", muted: "text-yellow-800", track: "bg-yellow-200", fill: "bg-yellow-500", label: "Needs attention" }
      : percentage <= 89
        ? { card: "border-amber-500 bg-amber-400 text-amber-950", muted: "text-amber-900", track: "bg-white/35", fill: "bg-amber-900", label: "Improving" }
        : percentage < 100
          ? { card: "border-emerald-300 bg-emerald-100 text-emerald-950", muted: "text-emerald-800", track: "bg-emerald-200", fill: "bg-emerald-600", label: "Strong" }
          : { card: "border-emerald-700 bg-emerald-600 text-white", muted: "text-white/80", track: "bg-white/25", fill: "bg-white", label: "Complete" };

  return (
    <article className={`relative overflow-hidden rounded-3xl border p-5 shadow-sm ${status.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${status.muted}`}>Readers who submitted</p>
        <span className="rounded-full bg-white/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em]">{percentage === 100 && <span aria-hidden="true">✓ </span>}{status.label}</span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight">{percentage}%</p>
      <div className={`mt-3 h-2 overflow-hidden rounded-full ${status.track}`}><div className={`h-full rounded-full ${status.fill}`} style={{ width: `${percentage}%` }} /></div>
      <p className={`mt-2 text-xs ${status.muted}`}><strong>{number.format(submitted)}</strong> of {number.format(active)} active readers</p>
      <button type="button" onClick={onBreakdown} className="mt-4 rounded-full bg-white/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition hover:bg-white/40">
        View breakdown
      </button>
    </article>
  );
}

function BreakdownModal({ metric, rows, scopeLevel, itemTotal, productTotal, onClose }: {
  metric: BreakdownMetric;
  rows: SubmissionRow[];
  scopeLevel: Overview["scope"]["level"];
  itemTotal: number;
  productTotal: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const configuration = {
    items: { title: "Items priced", noun: "active items" },
    products: { title: "Products priced", noun: "active products" },
    readers: { title: "Readers who submitted", noun: "active readers" },
  }[metric];

  const rankedRows = rows
    .map((row) => {
      const completed = metric === "items"
        ? row.items_priced
        : metric === "products"
          ? row.products_priced
          : row.readers_reporting ?? row.submitting_users ?? 0;
      const total = metric === "items"
        ? itemTotal
        : metric === "products"
          ? productTotal
          : row.active_readers || 0;
      const percentage = completionPercentage(completed, total);
      return { row, completed, total, percentage };
    })
    .sort((a, b) => a.percentage - b.percentage || a.completed - b.completed || a.row.name.localeCompare(b.row.name));

  const levelLabel = scopeLevel === "NATIONAL" ? "Region" : scopeLevel === "REGION" ? "District / market" : "Market";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="breakdown-title" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-prism-border/70 px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-teal">Worst performing first</p>
            <h2 id="breakdown-title" className="mt-1 text-xl font-black text-prism-text">{configuration.title} by {levelLabel.toLowerCase()}</h2>
            <p className="mt-1 text-xs text-prism-muted">Each percentage compares the completed number with the available {configuration.noun}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close breakdown" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted hover:text-prism-text">×</button>
        </header>

        <div className="overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-prism-muted">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-4 py-3">{levelLabel}</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-6 py-3 text-right">Performance</th>
              </tr>
            </thead>
            <tbody>
              {rankedRows.map(({ row, completed, total, percentage }, index) => {
                const tone = percentage < 50 ? "bg-red-100 text-red-700" : percentage < 80 ? "bg-yellow-100 text-yellow-800" : percentage < 100 ? "bg-emerald-100 text-emerald-800" : "bg-emerald-600 text-white";
                const location = scopeLevel === "REGION" ? row.district_name : row.region_name;
                return (
                  <tr key={row.id} className="border-t border-prism-border/60">
                    <td className="px-6 py-4 font-black text-prism-muted">{index + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-prism-text">{scopeLevel === "REGION" && row.district_name ? `${row.district_name} / ${row.name}` : row.name}</p>
                      {scopeLevel !== "REGION" && location && <p className="mt-0.5 text-[10px] text-prism-muted">{location}</p>}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-prism-text">{number.format(completed)}</td>
                    <td className="px-4 py-4 text-right text-prism-muted">{number.format(total)}</td>
                    <td className="px-6 py-4 text-right"><span className={`inline-flex min-w-16 justify-center rounded-full px-2.5 py-1 font-black ${tone}`}>{percentage.toFixed(1)}%</span></td>
                  </tr>
                );
              })}
              {!rankedRows.length && <tr><td colSpan={5} className="px-6 py-10 text-center text-prism-muted">No scoped locations are available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [level, setLevel] = useState<Level>("regions");
  const [regionId, setRegionId] = useState("all");
  const [districtId, setDistrictId] = useState("all");
  const [marketId, setMarketId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || "Unable to load dashboard data");
        return data;
      })
      .then((data: Overview) => {
        if (!active) return;
        setOverview(data);
        if (data.scope.level === "REGION") {
          setLevel("districts");
          setRegionId(data.scope.region_id || "all");
        } else if (data.scope.level === "MARKETS") {
          setLevel("markets");
        }
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredRows = useMemo(() => {
    if (!overview) return [];
    const rows = overview.submissions[level];
    return rows.filter((row) => {
      if (level !== "regions" && regionId !== "all" && row.region_id !== regionId) return false;
      if ((level === "markets" || level === "users") && districtId !== "all" && row.district_id !== districtId) return false;
      if (level === "users" && marketId !== "all" && row.market_id !== marketId) return false;
      return true;
    });
  }, [overview, level, regionId, districtId, marketId]);

  const availableDistricts = useMemo(() => {
    if (!overview) return [];
    return overview.submissions.districts.filter((row) => regionId === "all" || row.region_id === regionId);
  }, [overview, regionId]);

  const isRegional = overview?.scope.level === "REGION";
  const isSupervisor = overview?.scope.level === "MARKETS";
  const primarySubmissionRows = isSupervisor
    ? overview?.submissions.markets || []
    : isRegional
      ? overview?.submissions.districts || []
      : overview?.submissions.regions || [];
  const maxPrimarySubmissions = Math.max(...primarySubmissionRows.map((row) => row.prices_submitted), 1);
  const drillLevels: Level[] = isSupervisor
    ? ["markets", "users"]
    : isRegional
      ? ["districts", "markets", "users"]
      : ["regions", "districts", "markets", "users"];
  const breakdownRows = isRegional || isSupervisor
    ? overview?.submissions.markets || []
    : overview?.submissions.regions || [];

  const drillTo = (nextLevel: Level, row?: SubmissionRow) => {
    if (row?.region_id || level === "regions") setRegionId(row?.region_id || row?.id || "all");
    if (row?.district_id || level === "districts") setDistrictId(row?.district_id || row?.id || "all");
    if (row?.market_id || level === "markets") setMarketId(row?.market_id || row?.id || "all");
    setLevel(nextLevel);
  };

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 py-7 md:px-8 xl:px-10">
          <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Operations overview</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Market Initiation Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-prism-muted">
                {isSupervisor
                  ? "Track submitted prices, outlets and Market Readers only within your assigned markets."
                  : isRegional
                  ? `Track submitted prices across the districts, markets and field users in ${overview?.scope.region_name || "your assigned region"}.`
                  : "Track submitted prices from the national view down to regions, districts, markets and field users."}
              </p>
            </div>
            <div className="inline-flex w-fit rounded-full border border-prism-border bg-white p-1.5 shadow-sm">
              <button className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white">
                Market Initiation
              </button>
              <button disabled className="cursor-not-allowed rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-prism-muted opacity-60">
                Market Reading · Soon
              </button>
            </div>
          </section>

          {loading && <div className="mt-8 rounded-3xl bg-white p-10 text-center text-sm text-prism-muted shadow-sm">Loading live initiation data…</div>}
          {error && <div role="alert" className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

          {overview && (
            <>
              <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <MetricCard label="Prices submitted" value={overview.summary.prices_submitted} hint={`Latest: ${formatDate(overview.summary.last_submission_at)}`} accent="teal" />
                <MetricCard label="Items priced" value={overview.summary.items_priced} hint={`of ${number.format(overview.summary.items)} active items`} percentage={completionPercentage(overview.summary.items_priced, overview.summary.items)} onBreakdown={() => setBreakdownMetric("items")} />
                <MetricCard label="Products priced" value={overview.summary.products_priced} hint={`of ${number.format(overview.summary.products)} active products`} accent="pink" percentage={completionPercentage(overview.summary.products_priced, overview.summary.products)} onBreakdown={() => setBreakdownMetric("products")} />
                <MetricCard label={isSupervisor || isRegional ? "Districts" : "Regions"} value={isSupervisor || isRegional ? overview.summary.districts : overview.summary.regions} hint={isSupervisor ? `${number.format(overview.summary.regions)} region${overview.summary.regions === 1 ? "" : "s"} represented` : isRegional ? `${number.format(overview.summary.markets)} markets in ${overview.scope.region_name || "assigned region"}` : `${number.format(overview.summary.districts)} districts`} />
                <MetricCard label={isSupervisor ? "Assigned markets" : "Markets"} value={overview.summary.markets} hint={`${number.format(overview.summary.outlets)} active outlets`} accent="teal" />
                <MetricCard label="Outlets created" value={overview.summary.outlets_created} hint={`${number.format(overview.summary.outlets)} currently active`} accent="purple" />
                <ReaderSubmissionCard submitted={overview.summary.readers_reporting} active={overview.summary.active_readers} onBreakdown={() => setBreakdownMetric("readers")} />
                <MetricCard label="Users" value={overview.summary.users} hint="Active system users" accent="pink" />
              </section>

              {breakdownMetric && (
                <BreakdownModal
                  metric={breakdownMetric}
                  rows={breakdownRows}
                  scopeLevel={overview.scope.level}
                  itemTotal={overview.summary.items}
                  productTotal={overview.summary.products}
                  onClose={() => setBreakdownMetric(null)}
                />
              )}

              <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-3xl border border-prism-border/70 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-prism-text">Prices submitted by {isSupervisor ? "assigned market" : isRegional ? "district" : "region"}</h2>
                      <p className="mt-1 text-xs text-prism-muted">{isSupervisor ? "Only markets assigned to this Supervisor" : isRegional ? overview.scope.region_name : "All recorded market-initiation quote submissions"}</p>
                    </div>
                    <span className="rounded-full bg-prism-teal/10 px-3 py-1.5 text-xs font-bold text-teal-700">Live database</span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {primarySubmissionRows.map((row) => (
                      <button key={row.id} onClick={() => drillTo(isSupervisor ? "users" : isRegional ? "markets" : "districts", row)} className="group block w-full text-left">
                        <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                          <span className="font-bold text-prism-text group-hover:text-prism-purple">{row.name}</span>
                          <span className="font-black text-prism-purple">{number.format(row.prices_submitted)}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-prism-bg">
                          <div className="h-full rounded-full bg-gradient-to-r from-prism-teal to-prism-purple" style={{ width: `${Math.max((row.prices_submitted / maxPrimarySubmissions) * 100, row.prices_submitted ? 3 : 0)}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-prism-purple p-6 text-white shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-prism-teal-soft">Initiation footprint</p>
                  <p className="mt-4 text-5xl font-black">{number.format(overview.summary.prices_submitted)}</p>
                  <p className="mt-1 text-sm text-white/65">prices collected across {isSupervisor ? "your assigned markets" : isRegional ? "your assigned region" : "the system"}</p>
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    {[
                      ["Districts", overview.summary.districts],
                      ["Markets", overview.summary.markets],
                      ["Outlets", overview.summary.outlets],
                      ["Products", overview.summary.products],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white/10 p-4">
                        <p className="text-2xl font-black">{number.format(Number(value))}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-white/60">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mt-8 rounded-3xl border border-prism-border/70 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-prism-border/70 p-5 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h2 className="text-base font-black text-prism-text">Submission drill-down</h2>
                    <p className="mt-1 text-xs text-prism-muted">Switch level or click a row to move deeper.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {drillLevels.map((item) => (
                      <button key={item} onClick={() => setLevel(item)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition ${level === item ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted hover:text-prism-text"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {level !== "regions" && (
                  <div className="flex flex-wrap gap-3 border-b border-prism-border/60 bg-slate-50/70 px-5 py-4">
                    {isRegional ? (
                      <span className="rounded-xl border border-prism-teal/30 bg-prism-teal/10 px-3 py-2 text-xs font-bold text-teal-800">{overview.scope.region_name || "Assigned region"}</span>
                    ) : (
                      <select value={regionId} onChange={(event) => { setRegionId(event.target.value); setDistrictId("all"); setMarketId("all"); }} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text">
                        <option value="all">All regions</option>
                        {overview.submissions.regions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                      </select>
                    )}
                    {(level === "markets" || level === "users") && (
                      <select value={districtId} onChange={(event) => { setDistrictId(event.target.value); setMarketId("all"); }} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text">
                        <option value="all">All districts</option>
                        {availableDistricts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                      </select>
                    )}
                    {level === "users" && (
                      <select value={marketId} onChange={(event) => setMarketId(event.target.value)} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text">
                        <option value="all">All markets</option>
                        {overview.submissions.markets
                          .filter((row) => (regionId === "all" || row.region_id === regionId) && (districtId === "all" || row.district_id === districtId))
                          .map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-white text-[10px] uppercase tracking-[0.15em] text-prism-muted">
                      <tr>
                        <th className="px-5 py-3">{level.slice(0, -1)}</th>
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3 text-right">Prices submitted</th>
                        <th className="px-5 py-3 text-right">Items priced</th>
                        <th className="px-5 py-3 text-right">Products priced</th>
                        <th className="px-5 py-3">Last submission</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50/70">
                          <td className="px-5 py-4"><p className="font-bold text-prism-text">{row.name}</p><p className="mt-0.5 text-[10px] text-prism-muted">{row.code}</p></td>
                          <td className="px-5 py-4 text-prism-muted">{[row.market_name, row.district_name, row.region_name].filter(Boolean).join(" · ") || `${row.districts || 0} districts`}</td>
                          <td className="px-5 py-4 text-right text-sm font-black text-prism-purple">{number.format(row.prices_submitted)}</td>
                          <td className="px-5 py-4 text-right font-bold text-prism-text">{number.format(row.items_priced)}</td>
                          <td className="px-5 py-4 text-right font-bold text-prism-text">{number.format(row.products_priced)}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-prism-muted">{formatDate(row.last_submission_at)}</td>
                          <td className="px-5 py-4 text-right">
                            {level !== "users" && (
                              <button onClick={() => drillTo(level === "regions" ? "districts" : level === "districts" ? "markets" : "users", row)} className="whitespace-nowrap rounded-full bg-prism-bg px-3 py-1.5 font-bold text-prism-purple hover:bg-prism-purple hover:text-white">
                                View {level === "regions" ? "districts" : level === "districts" ? "markets" : "users"} →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!filteredRows.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-prism-muted">No records match this drill-down.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-8 grid gap-6 xl:grid-cols-2">
                <Ranking title="Most-priced items" subtitle="Items with the highest number of submitted prices" rows={overview.rankings.items} showProducts />
                <Ranking title="Most-priced products" subtitle="Products appearing most often in submissions" rows={overview.rankings.products} />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Ranking({ title, subtitle, rows, showProducts = false }: { title: string; subtitle: string; rows: RankingRow[]; showProducts?: boolean }) {
  const max = Math.max(...rows.map((row) => row.prices_submitted), 1);
  return (
    <section className="rounded-3xl border border-prism-border/70 bg-white p-6 shadow-sm">
      <h2 className="text-base font-black text-prism-text">{title}</h2>
      <p className="mt-1 text-xs text-prism-muted">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-prism-bg text-xs font-black text-prism-purple">{index + 1}</span>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-bold text-prism-text">{row.name}</p><span className="text-xs font-black text-prism-purple">{number.format(row.prices_submitted)}</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-prism-bg"><div className="h-full rounded-full bg-prism-teal" style={{ width: `${(row.prices_submitted / max) * 100}%` }} /></div>
              <p className="mt-1 text-[10px] text-prism-muted">{row.item_name || row.code} · {row.markets} markets{showProducts ? ` · ${row.products_priced || 0} products` : ""}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-prism-muted">prices</span>
          </div>
        ))}
      </div>
    </section>
  );
}
