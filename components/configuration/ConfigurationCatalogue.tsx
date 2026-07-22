"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TablePagination } from "@/components/common/TablePagination";

type RecordValue = string | number | boolean | null;
type CatalogRecord = Record<string, RecordValue> & { id: string };
type Column = { key: string; label: string; render?: (record: CatalogRecord) => React.ReactNode };
type Props = { entity: "regions" | "districts" | "markets" | "outlets" | "items"; title: string; description: string; columns: Column[] };

export function ConfigurationCatalogue({ entity, title, description, columns }: Props) {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(appliedSearch ? { search: appliedSearch } : {}) });
      const response = await fetch(`/api/dashboard/configuration/${entity}?${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || `Unable to load ${title.toLowerCase()}`);
      setRecords(body.records || []); setTotal(body.pagination?.total || 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to load ${title.toLowerCase()}`); }
    finally { setLoading(false); }
  }, [appliedSearch, entity, page, pageSize, title]);
  useEffect(() => { load(); }, [load]);

  return <div className="flex min-h-screen bg-prism-bg"><Sidebar /><div className="min-w-0 flex flex-1 flex-col"><Topbar /><main className="flex-1 px-5 py-7 md:px-8 xl:px-10"><header><p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Configuration catalogue</p><h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">{title}</h1><p className="mt-2 text-sm text-prism-muted">{description}</p></header>
    <section className="mt-7 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm"><form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }} className="flex flex-col gap-3 border-b border-prism-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-prism-text">{total.toLocaleString()} records</p><p className="mt-1 text-xs text-prism-muted">Read from the local PRISM database</p></div><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className="min-w-56 rounded-xl border border-prism-border px-3 py-2 text-xs" /><button className="rounded-full bg-prism-purple px-4 py-2 text-xs font-bold text-white">Search</button>{appliedSearch && <button type="button" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }} className="rounded-full border border-prism-border px-4 py-2 text-xs font-bold text-prism-muted">Clear</button>}</div></form>
      {error ? <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-prism-muted"><tr><th className="px-5 py-3 text-right">S/N</th>{columns.map((column) => <th key={column.key} className="px-5 py-3">{column.label}</th>)}</tr></thead><tbody>{!loading && records.map((record, index) => <tr key={record.id} className="border-t border-prism-border/60"><td className="px-5 py-4 text-right text-prism-muted">{(page - 1) * pageSize + index + 1}</td>{columns.map((column) => <td key={column.key} className="px-5 py-4 align-top text-prism-text">{column.render ? column.render(record) : formatValue(record[column.key])}</td>)}</tr>)}</tbody></table>{loading && <p className="p-10 text-center text-sm text-prism-muted">Loading {title.toLowerCase()}…</p>}{!loading && records.length === 0 && <p className="p-10 text-center text-sm text-prism-muted">No records found.</p>}</div>}
      <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section></main></div></div>;
}

function formatValue(value: RecordValue) {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  return String(value);
}
