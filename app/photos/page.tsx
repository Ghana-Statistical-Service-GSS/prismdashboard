/* eslint-disable @next/next/no-img-element -- MinIO presigned URLs expire and should be loaded directly rather than cached by the Next image optimizer. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SearchableSelect } from "@/components/common/SearchableSelect";

type Option = { id: string; name: string; region_id?: string; district_id?: string; market_id?: string };
type Filters = { regions: Option[]; districts: Option[]; markets: Option[]; items: Option[]; readers: Option[] };
type Photo = {
  id: string; image_url: string | null; captured_at: string | null; created_at: string;
  item_code: string; item_name: string; product_name: string; price: number; weight: number | null;
  uom_local: string | null; uom_standard: string | null; notes: string | null;
  outlet_code: string; outlet_name: string; market_name: string; district_name: string; region_name: string;
  reader_name: string; supervisor_approval: string; rs_approval: string; hq_approval: string;
};
type PageData = { rows: Photo[]; filters: Filters | null; image_url_expires_in: number; pagination: { page: number; page_size: number; total: number; total_pages: number } };

const emptyFilters: Filters = { regions: [], districts: [], markets: [], items: [], readers: [] };
const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 3 });

export default function PhotosPage() {
  const [rows, setRows] = useState<Photo[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [itemId, setItemId] = useState("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const filtersLoaded = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeFilters: String(!filtersLoaded.current) });
    if (regionId) params.set("regionId", regionId);
    if (districtId) params.set("districtId", districtId);
    if (marketId) params.set("marketId", marketId);
    if (itemId) params.set("itemId", itemId);
    if (userId) params.set("userId", userId);
    if (appliedSearch) params.set("search", appliedSearch);
    fetch(`/api/dashboard/photos?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message || "Unable to load photos"); return body as PageData; })
      .then((body) => {
        if (!active) return;
        setError("");
        setRows(body.rows); setTotal(body.pagination.total); setPages(body.pagination.total_pages);
        if (body.filters) { setFilters(body.filters); filtersLoaded.current = true; }
        const refreshIn = Math.max((body.image_url_expires_in - 30) * 1000, 60_000);
        refreshTimer = window.setTimeout(() => { if (active) setRefreshKey((value) => value + 1); }, refreshIn);
      })
      .catch((reason) => { if (active && reason.name !== "AbortError") setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); if (refreshTimer) window.clearTimeout(refreshTimer); };
  }, [page, pageSize, regionId, districtId, marketId, itemId, userId, appliedSearch, refreshKey]);

  const districts = useMemo(() => filters.districts.filter((row) => !regionId || row.region_id === regionId), [filters.districts, regionId]);
  const markets = useMemo(() => filters.markets.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId)), [filters.markets, regionId, districtId]);
  const readers = useMemo(() => filters.readers.filter((row) => (!regionId || row.region_id === regionId) && (!districtId || row.district_id === districtId) && (!marketId || row.market_id === marketId)), [filters.readers, regionId, districtId, marketId]);
  const resetPage = () => setPage(1);

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex-1"><Topbar />
        <main className="px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Initiation</p><h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Photo album</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">Review commodity evidence captured by Market Readers alongside its price, weight, outlet and location.</p></div><div className="rounded-2xl border border-prism-border bg-white px-5 py-3 text-sm shadow-sm"><span className="font-black text-prism-purple">{number.format(total)}</span><span className="ml-2 text-prism-muted">photos</span></div></header>

          <section className="mt-7 rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
              <Filter label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setUserId(""); resetPage(); }} options={filters.regions} />
              <Filter label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setUserId(""); resetPage(); }} options={districts} />
              <Filter label="Market" value={marketId} onChange={(value) => { setMarketId(value); setUserId(""); resetPage(); }} options={markets} />
              <Filter label="Commodity" value={itemId} onChange={(value) => { setItemId(value); resetPage(); }} options={filters.items} />
              <Filter label="Market reader" value={userId} onChange={(value) => { setUserId(value); resetPage(); }} options={readers} />
              <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Commodity, outlet…" className="mt-1 w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs font-medium normal-case tracking-normal outline-none focus:border-prism-purple" /></label>
            </div>
          </section>

          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          <section aria-busy={loading} className={`mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            {rows.map((photo, index) => <PhotoCard key={photo.id} photo={photo} priority={index < 4} onOpen={() => setSelected(photo)} />)}
          </section>
          {!loading && !rows.length && !error && <div className="mt-6 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">No photos match these filters.</div>}
          {loading && !rows.length && <div className="mt-6 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Preparing photo album…</div>}

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-prism-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-prism-muted">{number.format(total)} photos · Page {page} of {pages}</p><div className="flex flex-wrap items-center gap-2"><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-xl border border-prism-border px-3 py-2 text-xs"><option value={12}>12 per page</option><option value={24}>24 per page</option><option value={36}>36 per page</option><option value={48}>48 per page</option></select><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-prism-border px-4 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-prism-purple px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button></div></div>
        </main>
      </div>
      {selected && <PhotoModal photo={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
  return <div><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">{label}</span><div className="mt-1"><SearchableSelect value={value} onChange={onChange} placeholder={`All ${label.toLowerCase()}s`} options={options.map((row) => ({ value: row.id, label: row.name }))} /></div></div>;
}

function PhotoCard({ photo, priority, onOpen }: { photo: Photo; priority: boolean; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const uom = photo.uom_standard || photo.uom_local || "No UOM";
  return <article style={{ contentVisibility: "auto", containIntrinsicSize: "420px" }} className="overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><button type="button" onClick={onOpen} className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left">{photo.image_url && !failed ? <img src={photo.image_url} alt={`${photo.item_name} — ${photo.product_name}`} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "low"} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <span className="flex h-full items-center justify-center px-6 text-center text-xs font-semibold text-prism-muted">Photo unavailable from the configured storage</span>}<span className="absolute right-3 top-3 rounded-full bg-prism-purple/90 px-3 py-1.5 text-xs font-black text-white shadow">{money.format(photo.price)}</span><span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-prism-text backdrop-blur">View details</span></button><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-prism-teal">{photo.item_code}</p><h2 className="mt-1 line-clamp-1 text-base font-black text-prism-text">{photo.item_name}</h2><p className="mt-1 line-clamp-1 text-xs font-semibold text-prism-purple">{photo.product_name}</p>{photo.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-prism-muted">{photo.notes}</p>}<div className="mt-3 flex items-center justify-between text-xs"><span className="text-prism-muted">Weight</span><span className="font-bold text-prism-text">{photo.weight == null ? "—" : `${number.format(photo.weight)} ${uom}`}</span></div><div className="mt-2 border-t border-prism-border/60 pt-3 text-[11px] leading-5 text-prism-muted"><p className="font-semibold text-prism-text">{photo.outlet_name}</p><p>{photo.market_name} · {photo.region_name}</p><p>{photo.reader_name} · {formatDate(photo.captured_at || photo.created_at)}</p></div></div></article>;
}

function PhotoModal({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);
  const uom = photo.uom_standard || photo.uom_local || "No UOM";
  return <div role="dialog" aria-modal="true" aria-label={`${photo.item_name} photo details`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-prism-border px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-prism-teal">Commodity evidence</p><h2 className="mt-1 text-xl font-black text-prism-text">{photo.item_name} · {photo.product_name}</h2></div><button onClick={onClose} aria-label="Close photo" className="rounded-full bg-prism-bg px-4 py-2 text-lg font-bold text-prism-purple">×</button></div><div className="grid lg:grid-cols-[1.45fr_0.75fr]"><div className="flex min-h-72 items-center justify-center bg-slate-950">{photo.image_url && !failed ? <img src={photo.image_url} alt={`${photo.item_name} — ${photo.product_name}`} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-[72vh] w-full object-contain" /> : <p className="p-12 text-center text-sm text-white/70">Photo unavailable from the configured storage</p>}</div><div className="space-y-4 p-6"><Detail label="Price" value={money.format(photo.price)} strong />{photo.notes && <Detail label="Product description" value={photo.notes} />}<Detail label="Weight and UOM" value={photo.weight == null ? uom : `${number.format(photo.weight)} ${uom}`} /><Detail label="Region" value={photo.region_name} /><Detail label="District / Market" value={`${photo.district_name} · ${photo.market_name}`} /><Detail label="Outlet" value={`${photo.outlet_name}${photo.outlet_code ? ` (${photo.outlet_code})` : ""}`} /><Detail label="Market reader" value={photo.reader_name} /><Detail label="Captured" value={formatDate(photo.captured_at || photo.created_at)} /><Detail label="Approval" value={`Supervisor ${photo.supervisor_approval} · RS ${photo.rs_approval} · HQ ${photo.hq_approval}`} /></div></div></div></div>;
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">{label}</p><p className={`mt-1 text-sm ${strong ? "text-xl font-black text-prism-purple" : "font-semibold text-prism-text"}`}>{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
