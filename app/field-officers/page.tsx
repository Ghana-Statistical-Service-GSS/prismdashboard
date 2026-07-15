"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SearchableSelect } from "@/components/common/SearchableSelect";

type Officer = {
  id: string;
  name: string;
  email: string | null;
  last_login_at: string | null;
  market_id: string | null;
  market_name: string | null;
  district_id: string | null;
  district_name: string | null;
  region_id: string | null;
  region_name: string | null;
  outlets_created: number;
  outlets_covered: number;
  items_priced: number;
  products_priced: number;
  prices_submitted: number;
  last_submission_at: string | null;
};

const integer = new Intl.NumberFormat("en-GH");

function formatDate(value?: string | null) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(value));
}

type SortKey = "name" | "region_name" | "district_name" | "outlets_created" | "outlets_covered" | "items_priced" | "products_priced" | "prices_submitted" | "last_submission_at";

const NUMERIC_KEYS: SortKey[] = ["outlets_created", "outlets_covered", "items_priced", "products_priced", "prices_submitted"];

function SortHead({ label, sortKey, activeKey, direction, onSort, right = false }: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
  right?: boolean;
}) {
  const indicator = activeKey === sortKey ? (direction === "asc" ? "↑" : "↓") : "↕";
  return (
    <th className={`px-5 py-4 ${right ? "text-right" : ""}`}>
      <button onClick={() => onSort(sortKey)} className={`font-bold uppercase hover:text-prism-purple ${activeKey === sortKey ? "text-prism-purple" : ""}`}>
        {label} {indicator}
      </button>
    </th>
  );
}

export default function FieldOfficersPage() {
  const [rows, setRows] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regionId, setRegionId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/reports/initiation/field-officers", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load field officers");
        return body;
      })
      .then((body) => { if (active) setRows(body.rows); })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const regionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) if (row.region_id && row.region_name) map.set(row.region_id, row.region_name);
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const marketOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (!row.market_id || !row.market_name) continue;
      if (regionId && row.region_id !== regionId) continue;
      map.set(row.market_id, `${row.district_name ?? "—"} · ${row.market_name}`);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, regionId]);

  const [sortKey, setSortKey] = useState<SortKey>("prices_submitted");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) =>
      (!regionId || row.region_id === regionId) &&
      (!marketId || row.market_id === marketId) &&
      (!needle || row.name.toLowerCase().includes(needle) || (row.email ?? "").toLowerCase().includes(needle)));
  }, [rows, regionId, marketId, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    let result: number;
    if (typeof left === "number" && typeof right === "number") result = left - right;
    else result = String(left ?? "").localeCompare(String(right ?? ""));
    if (direction === "desc") result = -result;
    if (result === 0) result = b.prices_submitted - a.prices_submitted;
    return result;
  }), [filtered, sortKey, direction]);

  const pages = Math.max(Math.ceil(sorted.length / 10), 1);
  const visible = sorted.slice((page - 1) * 10, page * 10);

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />

      <div className="min-w-0 flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-prism-text">
                FIELD OFFICERS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can monitor field officers’ data collection performance here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/officer-avatar.png"
                alt="Field officers"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          <section className="mt-8">
            <div className="flex flex-col gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {integer.format(filtered.length)} FIELD OFFICERS
              </p>
              <div className="grid gap-3 md:grid-cols-3 lg:w-2/3">
                <SearchableSelect value={regionId} onChange={(next) => { setRegionId(next); setMarketId(""); setPage(1); }} placeholder="All regions" options={regionOptions} />
                <SearchableSelect value={marketId} onChange={(next) => { setMarketId(next); setPage(1); }} placeholder="All districts / markets" options={marketOptions} />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search officer name or email…" className="w-full rounded-xl border border-prism-border bg-white px-3 py-2 text-xs outline-none focus:border-prism-purple" />
              </div>
            </div>
          </section>

          {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-xs text-red-700">{error}</p>}

          <section className="mt-8">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-prism-border/70 text-[10px] uppercase tracking-[0.14em] text-prism-muted">
                    <tr>
                      <th className="px-5 py-4 text-right">Rank</th>
                      <SortHead label="Field officer" sortKey="name" activeKey={sortKey} direction={direction} onSort={handleSort} />
                      <SortHead label="Region" sortKey="region_name" activeKey={sortKey} direction={direction} onSort={handleSort} />
                      <SortHead label="District / Market" sortKey="district_name" activeKey={sortKey} direction={direction} onSort={handleSort} />
                      <SortHead label="Outlets created" sortKey="outlets_created" activeKey={sortKey} direction={direction} onSort={handleSort} right />
                      <SortHead label="Outlets covered" sortKey="outlets_covered" activeKey={sortKey} direction={direction} onSort={handleSort} right />
                      <SortHead label="Items priced" sortKey="items_priced" activeKey={sortKey} direction={direction} onSort={handleSort} right />
                      <SortHead label="Products priced" sortKey="products_priced" activeKey={sortKey} direction={direction} onSort={handleSort} right />
                      <SortHead label="Prices submitted" sortKey="prices_submitted" activeKey={sortKey} direction={direction} onSort={handleSort} right />
                      <SortHead label="Last submission" sortKey="last_submission_at" activeKey={sortKey} direction={direction} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className={loading ? "opacity-50" : ""}>
                    {visible.map((officer, index) => (
                      <tr key={officer.id} className="border-b border-prism-border/50 last:border-b-0 hover:bg-slate-50">
                        <td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * 10 + index + 1}</td>
                        <td className="px-5 py-4"><p className="font-bold text-prism-text">{officer.name}</p><p className="text-[10px] text-prism-muted">{officer.email || "—"}</p></td>
                        <td className="px-5 py-4 text-prism-muted">{officer.region_name || "—"}</td>
                        <td className="px-5 py-4 text-prism-muted">{officer.district_name || "—"}{officer.market_name ? ` · ${officer.market_name}` : ""}</td>
                        <td className="px-5 py-4 text-right font-black text-prism-purple">{integer.format(officer.outlets_created)}</td>
                        <td className="px-5 py-4 text-right">{integer.format(officer.outlets_covered)}</td>
                        <td className="px-5 py-4 text-right font-black text-prism-teal">{integer.format(officer.items_priced)}</td>
                        <td className="px-5 py-4 text-right font-black text-prism-pink">{integer.format(officer.products_priced)}</td>
                        <td className="px-5 py-4 text-right">{integer.format(officer.prices_submitted)}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-prism-muted">{formatDate(officer.last_submission_at)}</td>
                      </tr>
                    ))}
                    {!loading && !visible.length && <tr><td colSpan={10} className="px-5 py-12 text-center text-prism-muted">No field officers match the filters.</td></tr>}
                    {loading && !rows.length && <tr><td colSpan={10} className="px-5 py-12 text-center text-prism-muted">Loading field officers…</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-prism-border/70 p-5">
                <p className="text-xs text-prism-muted">{integer.format(filtered.length)} officers · Page {page} of {pages}</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-prism-border px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button>
                  <button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-prism-purple px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
