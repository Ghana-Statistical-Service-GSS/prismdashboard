"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SearchableSelect } from "@/components/common/SearchableSelect";

type Level = "regions" | "districts" | "markets";
type ReaderLevel = Level | "readers";

type GapRow = {
  id: string;
  code?: string;
  name: string;
  region_id?: string | null;
  district_id?: string | null;
  market_id?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  market_name?: string | null;
  districts?: number;
  markets?: number;
  markets_without_prices?: number;
  active_outlets?: number;
  assigned_readers?: number;
  active_readers?: number;
  readers_without_submissions?: number;
  last_login_at?: string | null;
};

type ItemOption = { id: string; code: string; name: string };

type ValidationData = {
  market_gaps: Record<Level, GapRow[]>;
  reader_gaps: Record<ReaderLevel, GapRow[]>;
  filters: { items: ItemOption[]; uoms: string[] };
};

type Comparison = {
  item_id: string;
  product_id: string | null;
  item_code: string;
  item_name: string;
  product_name: string;
  local_uom: string | null;
  standardized_uom: string | null;
  comparison_uom: string;
  uom_type: string;
  sample_size: number;
  products_compared: number;
  markets: number;
  readers: number;
  average_price: number;
  minimum_price: number;
  maximum_price: number;
  average_weight: number | null;
  average_price_per_weight: number | null;
  peer_average_price: number | null;
  worst_market_name: string | null;
  peer_products: number | null;
  compared_markets: number | null;
  price_deviation_pct: number | null;
  assessment: "PRICE_VARIANCE" | "WIDE_RANGE" | "CONSISTENT" | "NO_PEERS";
};

const num = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 2 });

export default function ValidationsPage() {
  const [data, setData] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/validations/initiation", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load validations");
        return body;
      })
      .then((body) => { if (active) setData(body); })
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
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Initiation</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Validations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">Find coverage gaps and compare products within the same item and UOM basis before initial prices become the reference for market reading.</p>
          </header>

          {loading && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Preparing validation statistics…</div>}
          {error && <div className="mt-8 rounded-3xl bg-red-50 p-5 text-sm text-red-700">{error}</div>}
          {data && <ValidationContent data={data} />}
        </main>
      </div>
    </div>
  );
}

function ValidationContent({ data }: { data: ValidationData }) {
  return (
    <>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Regions with missing markets" value={data.market_gaps.regions.length} tone="pink" />
        <Metric label="Districts without prices" value={data.market_gaps.districts.length} tone="pink" />
        <Metric label="Markets without prices" value={data.market_gaps.markets.length} tone="purple" />
        <Metric label="Readers without submissions" value={data.reader_gaps.readers.length} tone="teal" />
      </section>

      <MarketGapTable regions={data.market_gaps.regions} markets={data.market_gaps.markets} />
      <ReaderGapTable regions={data.reader_gaps.regions} readers={data.reader_gaps.readers} />
      <ComparisonTable items={data.filters.items} uoms={data.filters.uoms ?? []} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "pink" | "purple" | "teal" }) {
  const color = { pink: "bg-prism-pink", purple: "bg-prism-purple", teal: "bg-prism-teal" }[tone];
  return <article className="relative overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1.5 ${color}`} /><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-prism-muted">{label}</p><p className="mt-3 text-3xl font-black text-prism-text">{num.format(value)}</p></article>;
}

function useSortedRows(rows: GapRow[]) {
  const [sortKey, setSortKey] = useState<keyof GapRow>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sortKey] ?? "";
    const right = b[sortKey] ?? "";
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return direction === "asc" ? result : -result;
  }), [rows, sortKey, direction]);
  const sort = (key: keyof GapRow) => {
    if (sortKey === key) setDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(key); setDirection("asc"); }
  };
  return { sorted, sort };
}

function MarketGapTable({ regions, markets }: { regions: GapRow[]; markets: GapRow[] }) {
  const [regionId, setRegionId] = useState<string | null>(null);
  const [national, setNational] = useState(false);
  const [filterRegionId, setFilterRegionId] = useState("");
  const [filterMarketId, setFilterMarketId] = useState("");
  const [page, setPage] = useState(1);
  const detailRows = useMemo(() => markets.filter((row) => row.region_id === regionId), [markets, regionId]);
  const nationalRows = useMemo(() => markets.filter((row) => (!filterRegionId || row.region_id === filterRegionId) && (!filterMarketId || row.id === filterMarketId)), [markets, filterRegionId, filterMarketId]);
  const source = regionId ? detailRows : national ? nationalRows : regions;
  const { sorted, sort } = useSortedRows(source);
  const pages = Math.max(Math.ceil(sorted.length / 10), 1);
  const visible = sorted.slice((page - 1) * 10, page * 10);
  const selectedRegion = regions.find((row) => row.id === regionId);
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-prism-border/70 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="text-base font-black text-prism-text">Markets without initial prices</h2><p className="mt-1 text-xs text-prism-muted">{selectedRegion ? `${selectedRegion.name}: districts and their one-to-one markets without prices.` : national ? "All markets without initial prices nationwide." : "Select a region or open the national markets view."}</p></div><div className="flex gap-2">{selectedRegion && <button onClick={() => { setRegionId(null); setPage(1); }} className="rounded-full bg-prism-bg px-4 py-2 text-xs font-bold text-prism-purple">← All regions</button>}{!selectedRegion && <><button onClick={() => { setNational(false); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${!national ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-purple"}`}>Regional summary</button><button onClick={() => { setNational(true); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${national ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-purple"}`}>National markets</button></>}</div></div>
      {national && !selectedRegion && <div className="grid gap-3 border-b border-prism-border/60 bg-slate-50/60 p-4 md:grid-cols-2 xl:max-w-2xl"><SearchableSelect value={filterRegionId} onChange={(next) => { setFilterRegionId(next); setFilterMarketId(""); setPage(1); }} placeholder="All regions" options={regions.map((row) => ({ value: row.id, label: row.name }))} /><SearchableSelect value={filterMarketId} onChange={(next) => { setFilterMarketId(next); setPage(1); }} placeholder="All districts / markets" options={markets.filter((row) => !filterRegionId || row.region_id === filterRegionId).map((row) => ({ value: row.id, label: `${row.district_name} · ${row.name}` }))} /></div>}
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr>{!regionId && !national ? <><SortHead label="Region" onClick={() => sort("name")} /><SortHead label="Markets without prices" right onClick={() => sort("markets_without_prices")} /><th className="px-5 py-3" /></> : <>{national && <SortHead label="Region" onClick={() => sort("region_name")} />}<SortHead label="District" onClick={() => sort("district_name")} /><SortHead label="Market" onClick={() => sort("name")} /><SortHead label="Active outlets" right onClick={() => sort("active_outlets")} /><SortHead label="Assigned readers" right onClick={() => sort("assigned_readers")} /></>}</tr></thead><tbody>{visible.map((row) => !regionId && !national ? <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50"><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.name}</p><p className="text-[10px] text-prism-muted">{row.code}</p></td><td className="px-5 py-4 text-right font-black text-red-600">{row.markets_without_prices}</td><td className="px-5 py-4 text-right"><button onClick={() => { setRegionId(row.id); setNational(false); setPage(1); }} className="rounded-full bg-prism-purple px-3 py-1.5 text-[10px] font-bold text-white">View districts & markets →</button></td></tr> : <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50">{national && <td className="px-5 py-4 text-prism-muted">{row.region_name}</td>}<td className="px-5 py-4 font-semibold text-prism-text">{row.district_name}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.name}</p><p className="text-[10px] text-prism-muted">{row.code}</p></td><td className="px-5 py-4 text-right">{row.active_outlets ?? 0}</td><td className="px-5 py-4 text-right">{row.assigned_readers ?? 0}</td></tr>)}</tbody></table></div>
      <Pager page={page} pages={pages} total={sorted.length} onPage={setPage} />
    </section>
  );
}

function ReaderGapTable({ regions, readers }: { regions: GapRow[]; readers: GapRow[] }) {
  const [regionId, setRegionId] = useState<string | null>(null);
  const [national, setNational] = useState(false);
  const [filterRegionId, setFilterRegionId] = useState("");
  const [filterMarketId, setFilterMarketId] = useState("");
  const [page, setPage] = useState(1);
  const selectedRegion = regions.find((row) => row.id === regionId);
  const detailRows = useMemo(() => readers.filter((row) => row.region_id === regionId), [readers, regionId]);
  const nationalRows = useMemo(() => readers.filter((row) => (!filterRegionId || row.region_id === filterRegionId) && (!filterMarketId || row.market_id === filterMarketId)), [readers, filterRegionId, filterMarketId]);
  const source = regionId ? detailRows : national ? nationalRows : regions;
  const { sorted, sort } = useSortedRows(source);
  const pages = Math.max(Math.ceil(sorted.length / 10), 1);
  const visible = sorted.slice((page - 1) * 10, page * 10);
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-prism-border/70 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="text-base font-black text-prism-text">Readers without submissions</h2><p className="mt-1 text-xs text-prism-muted">{selectedRegion ? `${selectedRegion.name}: readers and their district/market assignments.` : national ? "All readers without submissions nationwide." : "Select a region or open the national reader view."}</p></div><div className="flex gap-2">{selectedRegion && <button onClick={() => { setRegionId(null); setPage(1); }} className="rounded-full bg-prism-bg px-4 py-2 text-xs font-bold text-prism-purple">← All regions</button>}{!selectedRegion && <><button onClick={() => { setNational(false); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${!national ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-purple"}`}>Regional summary</button><button onClick={() => { setNational(true); setPage(1); }} className={`rounded-full px-4 py-2 text-xs font-bold ${national ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-purple"}`}>National readers</button></>}</div></div>
      {national && !selectedRegion && <div className="grid gap-3 border-b border-prism-border/60 bg-slate-50/60 p-4 md:grid-cols-2 xl:max-w-2xl"><SearchableSelect value={filterRegionId} onChange={(next) => { setFilterRegionId(next); setFilterMarketId(""); setPage(1); }} placeholder="All regions" options={regions.map((row) => ({ value: row.id, label: row.name }))} /><SearchableSelect value={filterMarketId} onChange={(next) => { setFilterMarketId(next); setPage(1); }} placeholder="All districts / markets" options={Array.from(new Map(readers.filter((row) => row.market_id && (!filterRegionId || row.region_id === filterRegionId)).map((row) => [row.market_id, row])).values()).map((row) => ({ value: row.market_id!, label: `${row.district_name} · ${row.market_name}` }))} /></div>}
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr>{!regionId && !national ? <><SortHead label="Region" onClick={() => sort("name")} /><SortHead label="Readers without submissions" right onClick={() => sort("readers_without_submissions")} /><th className="px-5 py-3" /></> : <>{national && <SortHead label="Region" onClick={() => sort("region_name")} />}<SortHead label="Reader" onClick={() => sort("name")} /><SortHead label="District" onClick={() => sort("district_name")} /><SortHead label="Market" onClick={() => sort("market_name")} /><SortHead label="Last login" onClick={() => sort("last_login_at")} /></>}</tr></thead><tbody>{visible.map((row) => !regionId && !national ? <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50"><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.name}</p><p className="text-[10px] text-prism-muted">{row.code}</p></td><td className="px-5 py-4 text-right font-black text-red-600">{row.readers_without_submissions}</td><td className="px-5 py-4 text-right"><button onClick={() => { setRegionId(row.id); setNational(false); setPage(1); }} className="rounded-full bg-prism-purple px-3 py-1.5 text-[10px] font-bold text-white">View readers →</button></td></tr> : <tr key={row.id} className="border-t border-prism-border/60 hover:bg-slate-50">{national && <td className="px-5 py-4 text-prism-muted">{row.region_name}</td>}<td className="px-5 py-4 font-bold text-prism-text">{row.name}</td><td className="px-5 py-4 text-prism-muted">{row.district_name}</td><td className="px-5 py-4 text-prism-muted">{row.market_name}</td><td className="px-5 py-4 text-prism-muted">{formatDate(row.last_login_at)}</td></tr>)}</tbody></table></div>
      <Pager page={page} pages={pages} total={sorted.length} onPage={setPage} />
    </section>
  );
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-between border-t border-prism-border/70 p-5"><p className="text-xs text-prism-muted">{total} records · Page {page} of {pages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button></div></div>;
}

function SortHead({ label, onClick, right = false }: { label: string; onClick: () => void; right?: boolean }) {
  return <th className={`px-5 py-3 ${right ? "text-right" : ""}`}><button onClick={onClick} className="font-bold uppercase hover:text-prism-purple">{label} ↕</button></th>;
}

function ComparisonTable({ items, uoms }: { items: ItemOption[]; uoms: string[] }) {
  const [rows, setRows] = useState<Comparison[]>([]);
  const [selected, setSelected] = useState<Comparison | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [itemId, setItemId] = useState("");
  const [uomType, setUomType] = useState("");
  const [uom, setUom] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch((current) => {
        const next = search.trim();
        if (next !== current) setPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (itemId) params.set("itemId", itemId);
    if (uomType) params.set("uomType", uomType);
    if (uom) params.set("uom", uom);
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/dashboard/validations/initiation/comparisons?${params}`, { cache: "no-store" })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load comparisons");
        if (!active) return;
        setRows(body.rows); setTotal(body.pagination.total); setPages(body.pagination.total_pages);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, itemId, uomType, uom, appliedSearch]);

  const exportToExcel = async () => {
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams();
      if (itemId) params.set("itemId", itemId);
      if (uomType) params.set("uomType", uomType);
      if (uom) params.set("uom", uom);
      if (appliedSearch) params.set("search", appliedSearch);
      const response = await fetch(`/api/dashboard/validations/initiation/comparisons/export?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to export");
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(body.products ?? []), "Products");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(body.prices ?? []), "Prices");
      XLSX.writeFile(workbook, `prism-products-prices-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Unable to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
      <div className="border-b border-prism-border/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-base font-black text-prism-text">Item and product price comparison</h2><p className="mt-1 text-xs text-prism-muted">Products are compared against other products of the same item and UOM within the same market, where pack weights are within 10%. A ±25% gap against those peers is flagged.</p></div>
          <button onClick={exportToExcel} disabled={exporting} className="shrink-0 rounded-full bg-prism-teal px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{exporting ? "Exporting…" : "Export to Excel"}</button>
        </div>
        {exportError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{exportError}</p>}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchableSelect value={itemId} onChange={(next) => { setItemId(next); setPage(1); }} placeholder="All items" options={items.map((item) => ({ value: item.id, label: item.name, hint: item.code }))} />
          <SearchableSelect value={uom} onChange={(next) => { setUom(next); setPage(1); }} placeholder="All UOMs" options={uoms.map((value) => ({ value, label: value }))} />
          <SearchableSelect value={uomType} onChange={(next) => { setUomType(next); setPage(1); }} placeholder="All UOM types" options={[{ value: "LOCAL", label: "Local" }, { value: "STANDARDIZED", label: "Standardized" }, { value: "UNSPECIFIED", label: "Unspecified" }]} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or product…" className="min-w-0 rounded-xl border border-prism-border px-3 py-2 text-xs" />
        </div>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.12em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Item / Product</th><th className="px-5 py-3">UOM basis</th><th className="px-5 py-3 text-right">Samples</th><th className="px-5 py-3 text-right">Avg. weight</th><th className="px-5 py-3 text-right">Avg. price</th><th className="px-5 py-3 text-right">Peer average</th><th className="px-5 py-3 text-right">Gap vs peers</th><th className="px-5 py-3 text-right">Price / weight</th><th className="px-5 py-3">Assessment</th><th className="px-5 py-3" /></tr></thead><tbody className={loading ? "opacity-50" : ""}>{rows.map((row, index) => <tr key={`${row.item_id}-${row.product_name}-${row.comparison_uom}`} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * 10 + index + 1}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.item_name}</p><p className="text-[10px] text-prism-muted">{row.product_name} · {row.item_code}</p></td><td className="px-5 py-4"><p className="font-semibold text-prism-text">{row.comparison_uom}</p><p className="text-[10px] text-prism-muted">{row.uom_type} · {row.products_compared} products</p></td><td className="px-5 py-4 text-right">{row.sample_size}</td><td className="px-5 py-4 text-right">{row.average_weight == null ? "—" : num.format(row.average_weight)}</td><td className="px-5 py-4 text-right font-black text-prism-purple">{money.format(row.average_price)}</td><td className="px-5 py-4 text-right">{row.peer_average_price == null ? "—" : <><p className="font-semibold">{money.format(row.peer_average_price)}</p>{row.worst_market_name && <p className="text-[10px] text-prism-muted">{row.worst_market_name}</p>}</>}</td><td className={`px-5 py-4 text-right font-black ${(row.price_deviation_pct || 0) > 0 ? "text-red-600" : "text-teal-700"}`}>{row.price_deviation_pct == null ? "—" : `${row.price_deviation_pct > 0 ? "+" : ""}${num.format(row.price_deviation_pct)}%`}</td><td className="px-5 py-4 text-right">{row.average_price_per_weight == null ? "—" : money.format(row.average_price_per_weight)}</td><td className="px-5 py-4"><Assessment value={row.assessment} /></td><td className="px-5 py-4"><button onClick={() => setSelected(row)} className="whitespace-nowrap rounded-full bg-prism-purple px-3 py-1.5 text-[10px] font-bold text-white">View entries</button></td></tr>)}{!rows.length && !loading && <tr><td colSpan={11} className="px-5 py-10 text-center text-prism-muted">No comparisons match the filters.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-prism-border/70 p-5"><p className="text-xs text-prism-muted">{total} comparisons · Page {page} of {pages}</p><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button></div></div>
      {selected && <ComparisonEntriesModal comparison={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

type ComparisonEntry = {
  id: string;
  description: string | null;
  price: number;
  weight: number | null;
  uom_local: string | null;
  uom_standard: string | null;
  region_name: string;
  district_name: string;
  market_name: string;
  outlet_name: string;
  reader_name: string;
  created_at: string;
};

function ComparisonEntriesModal({ comparison, onClose }: { comparison: Comparison; onClose: () => void }) {
  const [rows, setRows] = useState<ComparisonEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: "10", itemId: comparison.item_id, comparisonUom: comparison.comparison_uom, uomType: comparison.uom_type });
    if (comparison.product_id) params.set("productId", comparison.product_id);
    fetch(`/api/dashboard/validations/initiation/comparison-entries?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load entries");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setRows(body.rows); setTotal(body.pagination.total); setPages(body.pagination.total_pages); setError("");
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [comparison, page]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-prism-border p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-prism-teal">Source submissions</p><h2 className="mt-1 text-xl font-black text-prism-text">{comparison.item_name} · {comparison.product_name}</h2><p className="mt-1 text-xs text-prism-muted">{comparison.comparison_uom} · {comparison.uom_type} · Average {money.format(comparison.average_price)} · {comparison.peer_average_price == null ? "No comparable peers" : `Peer average ${money.format(comparison.peer_average_price)}${comparison.worst_market_name ? ` in ${comparison.worst_market_name}` : ""}`}</p></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-prism-bg text-lg text-prism-text">×</button></div>
        {error && <p className="m-5 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <div className="max-h-[60vh] overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-white text-[10px] uppercase tracking-[0.12em] text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Price</th><th className="px-5 py-3 text-right">Weight</th><th className="px-5 py-3">Local UOM</th><th className="px-5 py-3">Standardized UOM</th><th className="px-5 py-3">Region / District / Market</th><th className="px-5 py-3">Outlet</th><th className="px-5 py-3">Reader</th><th className="px-5 py-3">Submitted</th></tr></thead><tbody className={loading ? "opacity-50" : ""}>{rows.map((row, index) => <tr key={row.id} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * 10 + index + 1}</td><td className="max-w-56 px-5 py-4 text-prism-muted">{row.description || "—"}</td><td className="px-5 py-4 text-right font-black text-prism-purple">{money.format(row.price)}</td><td className="px-5 py-4 text-right font-bold">{row.weight == null ? "—" : num.format(row.weight)}</td><td className="px-5 py-4 text-prism-muted">{row.uom_local || "—"}</td><td className="px-5 py-4 text-prism-muted">{row.uom_standard || "—"}</td><td className="px-5 py-4 text-prism-muted"><p>{row.region_name}</p><p className="text-[10px]">{row.district_name} · {row.market_name}</p></td><td className="px-5 py-4 text-prism-muted">{row.outlet_name}</td><td className="px-5 py-4 font-semibold text-prism-text">{row.reader_name}</td><td className="whitespace-nowrap px-5 py-4 text-prism-muted">{formatDate(row.created_at)}</td></tr>)}{!loading && !rows.length && <tr><td colSpan={10} className="px-5 py-10 text-center text-prism-muted">No source submissions found.</td></tr>}</tbody></table></div>
        <Pager page={page} pages={pages} total={total} onPage={setPage} />
      </section>
    </div>
  );
}

function Assessment({ value }: { value: Comparison["assessment"] }) {
  const config = { CONSISTENT: ["Consistent", "bg-teal-50 text-teal-700"], PRICE_VARIANCE: ["Price difference", "bg-red-50 text-red-700"], WIDE_RANGE: ["Wide range", "bg-amber-50 text-amber-700"], NO_PEERS: ["No peers", "bg-slate-100 text-slate-600"] }[value];
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold uppercase ${config[1]}`}>{config[0]}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "No login";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(value));
}
