"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { TablePagination } from "@/components/common/TablePagination";

type Option = { id: string; code?: string; name: string; region_id?: string; region_name?: string; district_id?: string; district_name?: string };
type Market = Option & { supervisor_id: string | null; supervisor_name: string | null; reader_count: number };
type Supervisor = { id: string; name: string; email: string; is_active: boolean; region_id: string | null; assignment_count: number; assigned_markets: string | null };
type Reader = { id: string; name: string; email: string; is_active: boolean; market_id: string; market_name: string; district_id: string; district_name: string; region_id: string; region_name: string };
type Data = { scope: { level: "REGION" | "NATIONAL"; role: string; region_id: string | null }; regions: Option[]; districts: Option[]; markets: Market[]; supervisors: Supervisor[]; readers: Reader[] };
type Tab = "markets" | "readers" | "users";
const roles = ["MARKET_READER", "SUPERVISOR", "REGIONAL_STATISTICIAN", "HQ", "ADMIN"];

export default function AssignmentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("markets");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/assignments", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to load assignments");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load assignments"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mutate = async (key: string, url: string, method: "PUT" | "PATCH" | "POST", body: object, success: string) => {
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || "Unable to save the change");
      setNotice(success); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save the change"); return false; }
    finally { setBusy(""); }
  };

  const isHq = data?.scope.role === "HQ" || data?.scope.role === "ADMIN";
  const tabs: { id: Tab; label: string }[] = [
    { id: "markets", label: "Markets & Supervisors" },
    { id: "readers", label: "Market Readers" },
    ...(isHq ? [{ id: "users" as Tab, label: "Create User" }] : []),
  ];

  return <div className="flex min-h-screen bg-prism-bg"><Sidebar /><div className="min-w-0 flex flex-1 flex-col"><Topbar />
    <main className="flex-1 px-5 py-7 md:px-8 xl:px-10">
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Access and coverage</p><h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Assignments</h1><p className="mt-2 max-w-3xl text-sm text-prism-muted">{data?.scope.level === "REGION" ? "Manage Supervisors and Market Readers within your assigned region." : "Manage national user accounts and operational assignments."}</p></header>
      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      {loading && !data ? <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Loading local assignment data…</div> : data && <>
        <div className="mt-7 flex flex-wrap gap-2">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-full px-4 py-2 text-xs font-bold ${tab === item.id ? "bg-prism-purple text-white" : "bg-white text-prism-muted"}`}>{item.label}</button>)}</div>
        {tab === "markets" && <MarketSupervisorPanel data={data} busy={busy} mutate={mutate} />}
        {tab === "readers" && <ReaderPanel data={data} busy={busy} mutate={mutate} />}
        {tab === "users" && isHq && <CreateUserPanel data={data} busy={busy} mutate={mutate} />}
      </>}
    </main></div></div>;
}

type Mutate = (key: string, url: string, method: "PUT" | "PATCH" | "POST", body: object, success: string) => Promise<boolean>;

function MarketSupervisorPanel({ data, busy, mutate }: { data: Data; busy: string; mutate: Mutate }) {
  const [region, setRegion] = useState(""); const [district, setDistrict] = useState(""); const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [marketPage, setMarketPage] = useState(1); const [marketPageSize, setMarketPageSize] = useState<10 | 20>(10);
  const [supervisorPage, setSupervisorPage] = useState(1); const [supervisorPageSize, setSupervisorPageSize] = useState<10 | 20>(10);
  const districts = data.districts.filter((row) => !region || row.region_id === region);
  const assignedCount = data.markets.filter((market) => market.supervisor_id).length;
  const unassignedCount = data.markets.length - assignedCount;
  const markets = useMemo(() => data.markets.filter((row) => (!region || row.region_id === region) && (!district || row.district_id === district) && (status === "all" || (status === "assigned" ? Boolean(row.supervisor_id) : !row.supervisor_id)) && (!search || `${row.name} ${row.district_name} ${row.supervisor_name || ""}`.toLowerCase().includes(search.toLowerCase()))), [data.markets, region, district, search, status]);
  const pagedMarkets = pageRows(markets, marketPage, marketPageSize);
  const pagedSupervisors = pageRows(data.supervisors, supervisorPage, supervisorPageSize);
  return <div className="mt-6 space-y-6">
    <section className="overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm"><div className="border-b border-prism-border p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black text-prism-text">District/market assignments</h2><p className="mt-1 text-xs text-prism-muted">The table is read only. Use the assignment button to select a market and Supervisor.</p></div><button onClick={() => setAssignmentOpen(true)} className="self-start rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white">Assign or reassign market</button></div><div className="mt-5 flex flex-wrap gap-2">{([{ id: "all", label: "All markets", count: data.markets.length }, { id: "assigned", label: "Assigned", count: assignedCount }, { id: "unassigned", label: "Unassigned", count: unassignedCount }] as const).map((item) => <button key={item.id} onClick={() => { setStatus(item.id); setMarketPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === item.id ? "border-prism-purple bg-prism-purple text-white" : "border-prism-border bg-white text-prism-muted"}`}>{item.label} <span className="ml-1 opacity-75">{item.count}</span></button>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Select value={region} onChange={(v) => { setRegion(v); setDistrict(""); setMarketPage(1); }} label="All regions" options={data.regions} /><Select value={district} onChange={(value) => { setDistrict(value); setMarketPage(1); }} label="All districts" options={districts} /><input value={search} onChange={(e) => { setSearch(e.target.value); setMarketPage(1); }} placeholder="Search market or Supervisor…" className="rounded-xl border border-prism-border px-3 py-2 text-xs" /></div></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-prism-muted"><tr><th className="px-5 py-3">District / Market</th><th className="px-5 py-3">Region</th><th className="px-5 py-3 text-right">Readers</th><th className="px-5 py-3">Current Supervisor</th><th className="px-5 py-3">Assignment status</th></tr></thead><tbody>{pagedMarkets.map((market) => <tr key={market.id} className="border-t border-prism-border/60"><td className="px-5 py-4"><b>{market.district_name}</b><p className="text-prism-muted">{market.name} · {market.code}</p></td><td className="px-5 py-4 text-prism-muted">{market.region_name}</td><td className="px-5 py-4 text-right font-bold">{market.reader_count}</td><td className="px-5 py-4"><b>{market.supervisor_name || "—"}</b></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${market.supervisor_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{market.supervisor_id ? "Assigned" : "Unassigned"}</span></td></tr>)}</tbody></table>{markets.length === 0 && <p className="p-8 text-center text-sm text-prism-muted">No markets match the selected filters.</p>}</div><TablePagination page={marketPage} pageSize={marketPageSize} total={markets.length} onPageChange={setMarketPage} onPageSizeChange={(size) => { setMarketPageSize(size); setMarketPage(1); }} />
    </section>
    <section className="overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm"><div className="border-b border-prism-border p-5"><h2 className="font-black text-prism-text">Supervisor accounts</h2><p className="mt-1 text-xs text-prism-muted">A Supervisor can only be disabled after every market assignment has been removed.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-prism-muted"><tr><th className="px-5 py-3">Supervisor</th><th className="px-5 py-3">Assigned markets</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{pagedSupervisors.map((s) => <tr key={s.id} className="border-t border-prism-border/60"><td className="px-5 py-4"><b>{s.name}</b><p className="text-prism-muted">{s.email}</p></td><td className="px-5 py-4">{s.assigned_markets || "None"} <span className="text-prism-muted">({s.assignment_count})</span></td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 font-bold ${s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{s.is_active ? "Active" : "Disabled"}</span></td><td className="px-5 py-4 text-right"><button disabled={busy === s.id || (s.is_active && s.assignment_count > 0)} onClick={() => mutate(s.id, `/api/dashboard/assignments/supervisors/${s.id}/status`, "PATCH", { isActive: !s.is_active }, s.is_active ? "Supervisor disabled." : "Supervisor enabled.")} className="rounded-full border border-prism-border px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-40">{s.is_active ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table></div><TablePagination page={supervisorPage} pageSize={supervisorPageSize} total={data.supervisors.length} onPageChange={setSupervisorPage} onPageSizeChange={(size) => { setSupervisorPageSize(size); setSupervisorPage(1); }} /></section>
    {assignmentOpen && <MarketAssignmentModal markets={data.markets} supervisors={data.supervisors} busy={busy.startsWith("market-")} onClose={() => setAssignmentOpen(false)} onConfirm={async (marketId, supervisorId) => { const saved = await mutate(`market-${marketId}`, `/api/dashboard/assignments/markets/${marketId}/supervisor`, "PUT", { supervisorId: supervisorId === UNASSIGNED ? null : supervisorId }, supervisorId === UNASSIGNED ? "Market assignment removed." : "Supervisor assignment updated."); if (saved) setAssignmentOpen(false); }} />}
  </div>;
}

function ReaderPanel({ data, busy, mutate }: { data: Data; busy: string; mutate: Mutate }) {
  const [market, setMarket] = useState(""); const [search, setSearch] = useState("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState<10 | 20>(10);
  const readers = data.readers.filter((r) => (!market || r.market_id === market) && (!search || `${r.name} ${r.email} ${r.market_name}`.toLowerCase().includes(search.toLowerCase())));
  const pagedReaders = pageRows(readers, page, pageSize);
  return <section className="mt-6 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm"><div className="border-b border-prism-border p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-black text-prism-text">Market Reader assignments</h2><p className="mt-1 text-xs text-prism-muted">The table is read only. Select the reader and destination market from the assignment modal.</p></div><button onClick={() => setAssignmentOpen(true)} className="self-start rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white">Reassign Market Reader</button></div><div className="mt-4 flex gap-2"><Select value={market} onChange={(value) => { setMarket(value); setPage(1); }} label="All markets" options={data.markets} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search reader…" className="rounded-xl border border-prism-border px-3 py-2 text-xs" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-prism-muted"><tr><th className="px-5 py-3">Reader</th><th className="px-5 py-3">Region</th><th className="px-5 py-3">Current district / market</th></tr></thead><tbody>{pagedReaders.map((reader) => <tr key={reader.id} className="border-t border-prism-border/60"><td className="px-5 py-4"><b>{reader.name}</b><p className="text-prism-muted">{reader.email}</p></td><td className="px-5 py-4 text-prism-muted">{reader.region_name}</td><td className="px-5 py-4"><b>{reader.district_name}</b><p className="text-prism-muted">{reader.market_name}</p></td></tr>)}</tbody></table></div><TablePagination page={page} pageSize={pageSize} total={readers.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />{assignmentOpen && <ReaderAssignmentModal readers={data.readers} markets={data.markets} busy={busy.startsWith("reader-")} onClose={() => setAssignmentOpen(false)} onConfirm={async (readerId, marketId) => { const saved = await mutate(`reader-${readerId}`, `/api/dashboard/assignments/readers/${readerId}/market`, "PUT", { marketId }, "Market Reader reassigned."); if (saved) setAssignmentOpen(false); }} />}</section>;
}

const UNASSIGNED = "__unassigned__";
type SearchOption = { id: string; label: string; detail?: string };

function MarketAssignmentModal({ markets, supervisors, busy, onClose, onConfirm }: { markets: Market[]; supervisors: Supervisor[]; busy: boolean; onClose: () => void; onConfirm: (marketId: string, supervisorId: string) => Promise<void> }) {
  const [marketId, setMarketId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const market = markets.find((item) => item.id === marketId);
  const next = supervisors.find((supervisor) => supervisor.id === supervisorId);
  const unchanged = market ? (supervisorId === UNASSIGNED ? !market.supervisor_id : supervisorId === market.supervisor_id) : false;
  const marketOptions: SearchOption[] = markets.map((item) => ({ id: item.id, label: `${item.district_name} · ${item.name}`, detail: `${item.region_name} · ${item.supervisor_name ? `Assigned to ${item.supervisor_name}` : "Unassigned"}` }));
  const supervisorOptions: SearchOption[] = [{ id: UNASSIGNED, label: "No Supervisor", detail: "Leave the selected market unassigned" }, ...supervisors.map((supervisor) => ({ id: supervisor.id, label: supervisor.name, detail: `${supervisor.assignment_count} market${supervisor.assignment_count === 1 ? "" : "s"} · ${supervisor.is_active ? "Active" : "Inactive — will be enabled"}` }))];
  return <ModalShell title="Assign or reassign market" subtitle="Select a market, then select its Supervisor" onClose={onClose} locked={busy}>
    {!reviewing ? <>
      <p className="text-sm text-prism-muted">Start typing to search by region, district, market, assignment status, or Supervisor name.</p>
      <div className="mt-5 space-y-4"><SearchableSelect label="District / market" value={marketId} onChange={(value) => { setMarketId(value); setSupervisorId(""); }} options={marketOptions} placeholder="Type a district or market name…" /><SearchableSelect key={marketId} label="New Supervisor" value={supervisorId} onChange={setSupervisorId} options={supervisorOptions} placeholder="Type a Supervisor name…" disabled={!marketId} /></div>
      <ModalActions onCancel={onClose}><button disabled={!market || !supervisorId || unchanged} onClick={() => setReviewing(true)} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Review change</button></ModalActions>
    </> : <>
      <ConfirmationNotice />
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><ReviewCard label="Current assignment" primary={market?.supervisor_name || "Unassigned"} secondary={market ? `${market.district_name} · ${market.name}` : ""} muted /><ReviewCard label="Proposed assignment" primary={supervisorId === UNASSIGNED ? "Unassigned" : next?.name || "Supervisor unavailable"} secondary={market ? `${market.district_name} · ${market.name}` : ""} /></div>
      <ModalActions onCancel={() => setReviewing(false)} cancelLabel="Back"><button disabled={busy || !market} onClick={() => market && onConfirm(market.id, supervisorId)} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm assignment"}</button></ModalActions>
    </>}
  </ModalShell>;
}

function ReaderAssignmentModal({ readers, markets, busy, onClose, onConfirm }: { readers: Reader[]; markets: Market[]; busy: boolean; onClose: () => void; onConfirm: (readerId: string, marketId: string) => Promise<void> }) {
  const [readerId, setReaderId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const reader = readers.find((item) => item.id === readerId);
  const next = markets.find((market) => market.id === marketId);
  const readerOptions: SearchOption[] = readers.map((item) => ({ id: item.id, label: item.name, detail: `${item.region_name} · ${item.district_name} · ${item.market_name}` }));
  const marketOptions: SearchOption[] = markets.map((market) => ({ id: market.id, label: `${market.district_name} · ${market.name}`, detail: `${market.region_name} · ${market.supervisor_name ? `Supervisor: ${market.supervisor_name}` : "No Supervisor"}` }));
  const unchanged = reader ? marketId === reader.market_id : false;
  return <ModalShell title="Reassign Market Reader" subtitle="Select a reader, then select the destination market" onClose={onClose} locked={busy}>
    {!reviewing ? <>
      <p className="text-sm text-prism-muted">Start typing to find the Market Reader and destination market. District and regional scope update automatically.</p>
      <div className="mt-5 space-y-4"><SearchableSelect label="Market Reader" value={readerId} onChange={(value) => { setReaderId(value); setMarketId(""); }} options={readerOptions} placeholder="Type the reader’s name…" /><SearchableSelect key={readerId} label="Destination district / market" value={marketId} onChange={setMarketId} options={marketOptions} placeholder="Type a district or market name…" disabled={!readerId} /></div>
      <ModalActions onCancel={onClose}><button disabled={!reader || !next || unchanged} onClick={() => setReviewing(true)} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Review change</button></ModalActions>
    </> : <>
      <ConfirmationNotice />
      <div className="rounded-2xl border border-prism-border bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">Market Reader</p><p className="mt-1 text-sm font-black text-prism-text">{reader?.name}</p></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><ReviewCard label="Current assignment" primary={reader ? `${reader.district_name} · ${reader.market_name}` : ""} secondary={reader?.region_name || ""} muted /><ReviewCard label="Proposed assignment" primary={next ? `${next.district_name} · ${next.name}` : "Market unavailable"} secondary={next?.region_name || ""} /></div>
      <ModalActions onCancel={() => setReviewing(false)} cancelLabel="Back"><button disabled={busy || !reader || !next} onClick={() => reader && next && onConfirm(reader.id, next.id)} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm reassignment"}</button></ModalActions>
    </>}
  </ModalShell>;
}

function SearchableSelect({ label, value, onChange, options, placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: SearchOption[]; placeholder: string; disabled?: boolean }) {
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const filtered = options.filter((option) => `${option.label} ${option.detail || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 40);
  return <label className="relative block text-xs font-bold text-prism-muted">{label}<input value={query} disabled={disabled} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); }} placeholder={placeholder} autoComplete="off" className="mt-2 w-full rounded-xl border border-prism-border px-3 py-3 text-sm font-normal text-prism-text disabled:bg-slate-100 disabled:text-slate-400" />{open && !disabled && <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-prism-border bg-white p-1 shadow-xl">{filtered.map((option) => <button type="button" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.id); setQuery(option.label); setOpen(false); }} className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"><span className="block text-xs font-bold text-prism-text">{option.label}</span>{option.detail && <span className="mt-0.5 block text-[11px] font-normal text-prism-muted">{option.detail}</span>}</button>)}{filtered.length === 0 && <p className="px-3 py-4 text-center text-xs font-normal text-prism-muted">No matching records</p>}</div>}</label>;
}

function ModalShell({ title, subtitle, onClose, locked, children }: { title: string; subtitle: string; onClose: () => void; locked: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose(); }}><div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-prism-border px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-prism-teal">Assignment change</p><h3 id="assignment-modal-title" className="mt-1 text-xl font-black text-prism-text">{title}</h3><p className="mt-1 text-xs text-prism-muted">{subtitle}</p></div><button disabled={locked} onClick={onClose} aria-label="Close modal" className="rounded-full border border-prism-border px-3 py-1.5 text-sm font-bold text-prism-muted disabled:opacity-40">×</button></div><div className="p-6">{children}</div></div></div>;
}

function ConfirmationNotice() { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">Approve this assignment change?</p><p className="mt-1 text-xs leading-5 text-amber-800">Review the details carefully. The database will only be updated after you confirm.</p></div>; }
function ReviewCard({ label, primary, secondary, muted = false }: { label: string; primary: string; secondary: string; muted?: boolean }) { return <div className={`rounded-2xl border p-4 ${muted ? "border-slate-200 bg-slate-50" : "border-prism-teal/30 bg-teal-50/60"}`}><p className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">{label}</p><p className="mt-2 text-sm font-black text-prism-text">{primary}</p><p className="mt-1 text-xs text-prism-muted">{secondary}</p></div>; }
function ModalActions({ onCancel, cancelLabel = "Cancel", children }: { onCancel: () => void; cancelLabel?: string; children: React.ReactNode }) { return <div className="mt-6 flex items-center justify-end gap-2"><button onClick={onCancel} className="rounded-full border border-prism-border px-5 py-2.5 text-xs font-bold text-prism-muted">{cancelLabel}</button>{children}</div>; }

function CreateUserPanel({ data, busy, mutate }: { data: Data; busy: string; mutate: Mutate }) {
  const [role, setRole] = useState("MARKET_READER");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const target = event.currentTarget; const form = new FormData(target); const saved = await mutate("create", "/api/dashboard/assignments/users", "POST", { fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"), role, regionId: form.get("regionId") || null, marketId: form.get("marketId") || null }, "User account created successfully."); if (saved) target.reset(); };
  return <section className="mt-6 max-w-3xl rounded-3xl border border-prism-border/70 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-prism-text">Create a new user</h2><p className="mt-1 text-xs text-prism-muted">HQ and Admin accounts can create users and specify their operational role.</p><form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2"><Field name="fullName" label="Full name" required /><Field name="email" label="Official email" type="email" required /><label className="text-xs font-bold text-prism-muted">Role<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-prism-text">{roles.map((item) => <option key={item}>{item}</option>)}</select></label><Field name="password" label="Initial password" defaultValue="12345678" required />{role === "REGIONAL_STATISTICIAN" || role === "SUPERVISOR" ? <label className="text-xs font-bold text-prism-muted">Region<select name="regionId" required={role === "REGIONAL_STATISTICIAN"} className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-prism-text"><option value="">Select region</option>{data.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : null}{role === "MARKET_READER" && <label className="text-xs font-bold text-prism-muted">Market<select name="marketId" required className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-prism-text"><option value="">Select district / market</option>{data.markets.map((m) => <option key={m.id} value={m.id}>{m.region_name} · {m.district_name} · {m.name}</option>)}</select></label>}<div className="md:col-span-2"><button disabled={busy === "create"} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === "create" ? "Creating…" : "Create user"}</button></div></form></section>;
}

function Select({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Option[] }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text"><option value="">{label}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>; }
function Field({ name, label, type = "text", defaultValue, required }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) { return <label className="text-xs font-bold text-prism-muted">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} className="mt-1 w-full rounded-xl border border-prism-border px-3 py-2 text-prism-text" /></label>; }
function pageRows<T>(rows: T[], page: number, pageSize: number) { const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))); return rows.slice((safePage - 1) * pageSize, safePage * pageSize); }
