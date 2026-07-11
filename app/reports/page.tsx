"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type FilterOption = {
  id: string;
  name: string;
  region_id?: string | null;
  district_id?: string | null;
  market_id?: string | null;
};

type Report = {
  summary: {
    prices_submitted: number;
    items_priced: number;
    products_priced: number;
    product_linked_quotes: number;
    weighted_quotes: number;
    standardized_uom_quotes: number;
    local_uom_quotes: number;
    average_price: number | null;
    average_weight: number | null;
    minimum_price: number | null;
    maximum_price: number | null;
    last_submission_at: string | null;
    active_items: number;
    active_products: number;
    total_markets: number;
    markets_reporting: number;
    active_readers: number;
    readers_reporting: number;
  };
  filters: {
    regions: FilterOption[];
    districts: FilterOption[];
    markets: FilterOption[];
    users: FilterOption[];
    uoms: FilterOption[];
  };
};

const integer = new Intl.NumberFormat("en-GH");
const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 2 });

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function date(value: string | null | undefined) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/reports/initiation", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || "Unable to load initiation report");
        return data;
      })
      .then((data) => { if (active) setReport(data); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Initiation</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Monitoring Reports</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">
                Monitor the initial product prices, weights and coverage collected before routine market pricing begins.
              </p>
            </div>
            <div className="inline-flex w-fit rounded-full border border-prism-border bg-white p-1.5 shadow-sm">
              <span className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white">Market Initiation</span>
              <span className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-prism-muted opacity-60">Market Reading · Soon</span>
            </div>
          </header>

          {loading && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted shadow-sm">Analysing live initiation submissions…</div>}
          {error && <div role="alert" className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

          {report && <ReportContent report={report} />}
        </main>
      </div>
    </div>
  );
}

function ReportContent({ report }: { report: Report }) {
  const s = report.summary;
  const quality = [
    { label: "Positive weights", value: s.weighted_quotes, total: s.prices_submitted, note: "Every initial price should include a usable weight." },
    { label: "Product linkage", value: s.product_linked_quotes, total: s.prices_submitted, note: "Submissions linked to a defined product." },
    { label: "Standard UOM", value: s.standardized_uom_quotes, total: s.prices_submitted, note: "Required for comparable prices and weights." },
    { label: "Markets reporting", value: s.markets_reporting, total: s.total_markets, note: "Markets with at least one initial price." },
    { label: "Readers reporting", value: s.readers_reporting, total: s.active_readers, note: "Active readers who have submitted prices." },
    { label: "Item coverage", value: s.items_priced, total: s.active_items, note: "Active items with at least one initial price." },
  ];

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Prices submitted" value={integer.format(s.prices_submitted)} detail={`Latest ${date(s.last_submission_at)}`} color="teal" />
        <SummaryCard label="Products priced" value={`${integer.format(s.products_priced)} / ${integer.format(s.active_products)}`} detail={`${pct(s.products_priced, s.active_products)}% product coverage`} color="purple" />
        <SummaryCard label="Markets reporting" value={`${s.markets_reporting} / ${s.total_markets}`} detail={`${s.total_markets - s.markets_reporting} markets need attention`} color="pink" />
        <SummaryCard label="Readers reporting" value={`${s.readers_reporting} / ${s.active_readers}`} detail={`${s.active_readers - s.readers_reporting} readers have no prices`} color="orange" />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quality.map((item) => <QualityCard key={item.label} {...item} />)}
      </section>

      <section className="mt-8 rounded-3xl border border-prism-border/70 bg-white shadow-sm">
        <SubmissionTable filters={report.filters} />
      </section>

    </>
  );
}

function SummaryCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: "teal" | "purple" | "pink" | "orange" }) {
  const styles = { teal: "bg-prism-teal", purple: "bg-prism-purple", pink: "bg-prism-pink", orange: "bg-amber-500" };
  return <article className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1.5 ${styles[color]}`} /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-prism-muted">{label}</p><p className="mt-3 text-3xl font-black tracking-tight text-prism-text">{value}</p><p className="mt-1 text-xs text-prism-muted">{detail}</p></article>;
}

function QualityCard({ label, value, total, note }: { label: string; value: number; total: number; note: string }) {
  const percent = pct(value, total);
  const color = percent >= 90 ? "bg-prism-teal" : percent >= 60 ? "bg-amber-400" : "bg-prism-pink";
  return <article className="rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black text-prism-text">{label}</p><span className="text-lg font-black text-prism-purple">{percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-prism-bg"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs text-prism-muted"><strong className="text-prism-text">{integer.format(value)} of {integer.format(total)}</strong> · {note}</p></article>;
}

type Submission = {
  id: string;
  item_code: string;
  item_name: string;
  product_name: string;
  price: number;
  weight: number | null;
  uom_local: string | null;
  uom_standard: string | null;
  uom_type: "LOCAL" | "STANDARDIZED" | null;
  region_name: string;
  district_name: string;
  market_name: string;
  outlet_name: string;
  reader_name: string;
  created_at: string;
};

function SubmissionTable({ filters }: { filters: Report["filters"] }) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [userId, setUserId] = useState("");
  const [uom, setUom] = useState("");
  const [uomType, setUomType] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const districts = useMemo(() => filters.districts.filter((row) => !regionId || row.region_id === regionId), [filters.districts, regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId)), [filters.markets, regionId, districtId]);
  const users = useMemo(() => filters.users.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId) && (!marketId || row.market_id === marketId)), [filters.users, regionId, districtId, marketId]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (marketId) params.set("marketId", marketId);
    if (userId) params.set("userId", userId);
    if (uom) params.set("uom", uom);
    if (uomType) params.set("uomType", uomType);
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/dashboard/reports/initiation/submissions?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error?.message || "Unable to load submissions");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setError("");
        setRows(data.rows);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, pageSize, regionId, districtId, marketId, userId, uom, uomType, appliedSearch]);

  const resetPage = () => setPage(1);

  return (
    <div>
      <div className="border-b border-prism-border/70 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-black text-prism-text">Products and Prices</h2>
          <p className="text-xs text-prism-muted">Individual market-initiation submissions with captured price and weight.</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <FilterSelect label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setUserId(""); resetPage(); }} options={filters.regions} />
          <FilterSelect label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setUserId(""); resetPage(); }} options={districts} />
          <FilterSelect label="Market" value={marketId} onChange={(value) => { setMarketId(value); setUserId(""); resetPage(); }} options={markets} />
          <FilterSelect label="Market reader" value={userId} onChange={(value) => { setUserId(value); resetPage(); }} options={users} />
          <FilterSelect label="UOM" value={uom} onChange={(value) => { setUom(value); resetPage(); }} options={filters.uoms} />
          <FilterSelect label="UOM type" value={uomType} onChange={(value) => { setUomType(value); resetPage(); }} options={[{ id: "LOCAL", name: "Local" }, { id: "STANDARDIZED", name: "Standardized" }]} />
          <form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); resetPage(); }}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">Search</label>
            <div className="mt-1 flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item or product" className="min-w-0 flex-1 rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" /><button className="rounded-xl bg-prism-purple px-3 text-xs font-bold text-white">Go</button></div>
          </form>
        </div>
      </div>

      {error && <p className="m-5 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white text-[10px] uppercase tracking-[0.14em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Item</th><th className="px-5 py-3">Product</th><th className="px-5 py-3 text-right">Price</th><th className="px-5 py-3 text-right">Weight</th><th className="px-5 py-3">Local UOM</th><th className="px-5 py-3">Standardized UOM</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Region / District / Market</th><th className="px-5 py-3">Outlet</th><th className="px-5 py-3">Market reader</th><th className="px-5 py-3">Submitted</th></tr></thead>
          <tbody className={loading ? "opacity-50" : ""}>{rows.map((row, index) => <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50"><td className="px-5 py-4 text-right font-bold text-prism-muted">{(page - 1) * pageSize + index + 1}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.item_name}</p><p className="text-[10px] text-prism-muted">{row.item_code}</p></td><td className="px-5 py-4 font-semibold text-prism-text">{row.product_name}</td><td className="px-5 py-4 text-right text-sm font-black text-prism-purple">{money.format(Number(row.price))}</td><td className="px-5 py-4 text-right font-bold text-prism-text">{row.weight == null ? "—" : integer.format(Number(row.weight))}</td><td className="px-5 py-4 text-prism-muted">{row.uom_local || "—"}</td><td className="px-5 py-4 text-prism-muted">{row.uom_standard || "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.uom_type === "LOCAL" ? "bg-amber-50 text-amber-700" : row.uom_type === "STANDARDIZED" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{row.uom_type || "—"}</span></td><td className="px-5 py-4 text-prism-muted"><p>{row.region_name}</p><p className="text-[10px]">{row.district_name} · {row.market_name}</p></td><td className="px-5 py-4 text-prism-muted">{row.outlet_name}</td><td className="px-5 py-4 font-semibold text-prism-text">{row.reader_name}</td><td className="whitespace-nowrap px-5 py-4 text-prism-muted">{date(row.created_at)}</td></tr>)}{!loading && !rows.length && <tr><td colSpan={12} className="px-5 py-12 text-center text-prism-muted">No submissions match these filters.</td></tr>}</tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-prism-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-prism-muted">{integer.format(total)} submissions · Page {page} of {totalPages}</p>
        <div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-xl border border-prism-border px-3 py-2 text-xs"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option></select><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button></div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: FilterOption[] }) {
  return <label><span className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text"><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}
