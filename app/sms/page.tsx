"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type Option = { id: string; name: string; region_id?: string; district_id?: string };
type Recipient = {
  id: string; name: string; phone_number: string | null; last_login_at: string | null; last_synced_at: string | null;
  region_name: string | null; district_name: string | null; market_name: string | null;
  region_id: string | null; district_id: string | null; market_id: string | null;
  submissions: number; sms_sent_count: number; last_sms_at: string | null;
};
type RecipientData = {
  rows: Recipient[];
  filters: { regions: Option[]; districts: Option[]; markets: Option[] };
  pagination: { page: number; page_size: number; total: number; selectable_total: number; total_pages: number };
};

const defaultMessage = "PRISM reminder: You have not logged in or synced your market initiation data. Please open the app, complete your work and sync as soon as possible.";
const statusOptions = [
  { value: "NEVER_LOGGED_IN", label: "Never logged in" },
  { value: "NOT_SYNCED", label: "No submission synced" },
  { value: "ALL_INACTIVE", label: "Not logged in or not synced" },
];

export default function SmsPage() {
  const [data, setData] = useState<RecipientData | null>(null);
  const [status, setStatus] = useState("NEVER_LOGGED_IN");
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(defaultMessage);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setSelected(new Set());
    setSelectAll(false);
    setExcluded(new Set());
  }, [status, regionId, districtId, marketId, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      const params = new URLSearchParams({ page: String(page), pageSize: "10", status });
      if (regionId) params.set("regionId", regionId);
      if (districtId) params.set("districtId", districtId);
      if (marketId) params.set("marketId", marketId);
      if (search.trim()) params.set("search", search.trim());
      try {
        const response = await fetch(`/api/dashboard/sms/recipients?${params}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load SMS recipients");
        setData(body);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError((reason as Error).message);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [status, regionId, districtId, marketId, search, page, refresh]);

  const validRows = useMemo(() => data?.rows.filter((row) => hasValidPhone(row.phone_number)) ?? [], [data]);
  const districts = data?.filters.districts.filter((row) => !regionId || row.region_id === regionId) ?? [];
  const markets = data?.filters.markets.filter((row) => !districtId || row.district_id === districtId) ?? [];
  const smsParts = Math.max(Math.ceil(message.length / 160), 1);
  const selectedCount = selectAll ? Math.max((data?.pagination.selectable_total ?? 0) - excluded.size, 0) : selected.size;
  const pageFullySelected = validRows.length > 0 && validRows.every((row) => selectAll ? !excluded.has(row.id) : selected.has(row.id));

  const togglePage = () => {
    if (selectAll) {
      setExcluded((current) => { const next = new Set(current); for (const row of validRows) { if (pageFullySelected) next.add(row.id); else next.delete(row.id); } return next; });
    } else {
      setSelected((current) => { const next = new Set(current); for (const row of validRows) { if (pageFullySelected) next.delete(row.id); else next.add(row.id); } return next; });
    }
  };

  const toggleAllMatching = () => {
    setSelectAll((current) => !current);
    setSelected(new Set());
    setExcluded(new Set());
  };

  async function sendMessages() {
    if (!selectedCount || !message.trim()) return;
    if (!window.confirm(`Send this SMS to ${selectedCount} selected market reader${selectedCount === 1 ? "" : "s"}?`)) return;
    setSending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/dashboard/sms/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientIds: [...selected], selectAll, excludedIds: [...excluded], message: message.trim(), status,
          filters: { regionId, districtId, marketId, search: search.trim() },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to send SMS alerts");
      setNotice(`${body.sent} sent · ${body.failed} failed · ${body.skipped} skipped`);
      setSelected(new Set()); setRefresh((value) => value + 1);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSending(false); }
  }

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex-1"><Topbar />
        <main className="px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Communications</p><h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">SMS alerts</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">Find market readers who have not started or synced, add missing phone numbers, and send a customized reminder.</p></div>
            <div className="rounded-2xl border border-prism-border bg-white px-5 py-3 text-sm shadow-sm"><span className="font-black text-prism-purple">{data?.pagination.total ?? 0}</span><span className="ml-2 text-prism-muted">matching readers</span></div>
          </header>

          <section className="mt-7 rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Filter label="Activity status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={statusOptions} />
              <Filter label="Region" value={regionId} onChange={(value) => { setRegionId(value); setDistrictId(""); setMarketId(""); setPage(1); }} options={(data?.filters.regions ?? []).map(option)} empty="All regions" />
              <Filter label="District" value={districtId} onChange={(value) => { setDistrictId(value); setMarketId(""); setPage(1); }} options={districts.map(option)} empty="All districts" />
              <Filter label="Market" value={marketId} onChange={(value) => { setMarketId(value); setPage(1); }} options={markets.map(option)} empty="All markets" />
              <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Reader or phone" className="mt-2 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-prism-text outline-none focus:border-prism-purple" /></label>
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-prism-border/70 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="font-black text-prism-text">Recipients</h2><p className="mt-1 text-xs text-prism-muted">Only readers with valid phone numbers can be selected.</p></div><div className="flex flex-wrap gap-2"><button onClick={togglePage} disabled={!validRows.length} className="rounded-full bg-prism-bg px-4 py-2 text-xs font-bold text-prism-purple disabled:opacity-40">{pageFullySelected ? "Clear this page" : "Select this page"}</button><button onClick={toggleAllMatching} disabled={!data?.pagination.selectable_total} className={`rounded-full px-4 py-2 text-xs font-bold disabled:opacity-40 ${selectAll ? "bg-prism-pink text-white" : "bg-prism-purple text-white"}`}>{selectAll ? "Clear all recipients" : `Select all ${data?.pagination.selectable_total ?? 0} recipients`}</button></div></div>
            {error && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700">{error}</div>}
            {notice && <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-700">{notice}</div>}
            <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-5 py-3">Select</th><th className="px-5 py-3">Market reader</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Activity</th><th className="px-5 py-3">Phone number</th><th className="px-5 py-3">SMS history</th></tr></thead>
              <tbody>{loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-prism-muted">Loading recipients…</td></tr> : data?.rows.length ? data.rows.map((row) => <RecipientRow key={row.id} row={row} checked={selectAll ? !excluded.has(row.id) && hasValidPhone(row.phone_number) : selected.has(row.id)} onCheck={() => { if (selectAll) setExcluded((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; }); else setSelected((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; }); }} onSaved={(id) => { setExcluded((current) => { const next = new Set(current); next.delete(id); return next; }); if (!selectAll) setSelected((current) => new Set(current).add(id)); setRefresh((value) => value + 1); }} />) : <tr><td colSpan={6} className="px-5 py-12 text-center text-prism-muted">No readers match these filters.</td></tr>}</tbody>
            </table></div>
            {data && <Pager page={data.pagination.page} pages={data.pagination.total_pages} total={data.pagination.total} onPage={setPage} />}
          </section>

          {selectAll && <div className="mt-5 rounded-2xl border border-prism-purple/20 bg-purple-50 px-5 py-3 text-xs font-semibold text-prism-purple">All {data?.pagination.selectable_total ?? 0} eligible recipients matching the current filters are selected. You can untick individual readers to exclude them.</div>}
          <section className="mt-5 rounded-3xl border border-prism-border/70 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end"><label className="flex-1 text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">Message<textarea value={message} maxLength={480} onChange={(event) => setMessage(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-2xl border border-prism-border px-4 py-3 text-sm font-medium normal-case leading-6 tracking-normal text-prism-text outline-none focus:border-prism-purple" /></label><div className="min-w-52"><p className="text-xs text-prism-muted">{message.length}/480 characters · about {smsParts} SMS part{smsParts === 1 ? "" : "s"}</p><button onClick={sendMessages} disabled={sending || !selectedCount || !message.trim()} className="mt-3 w-full rounded-full bg-prism-purple px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{sending ? "Sending…" : `Send to ${selectedCount} selected`}</button></div></div>
          </section>
        </main>
      </div>
    </div>
  );
}

function option(row: Option) { return { value: row.id, label: row.name }; }

function Filter({ label, value, onChange, options, empty }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; empty?: string }) {
  return <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-prism-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-prism-text outline-none focus:border-prism-purple">{empty && <option value="">{empty}</option>}{options.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}</select></label>;
}

function RecipientRow({ row, checked, onCheck, onSaved }: { row: Recipient; checked: boolean; onCheck: () => void; onSaved: (id: string) => void }) {
  const [phone, setPhone] = useState(row.phone_number ?? "");
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  useEffect(() => setPhone(row.phone_number ?? ""), [row.phone_number]);
  async function savePhone() {
    setSaving(true); setPhoneError("");
    try {
      const response = await fetch(`/api/dashboard/sms/recipients/${row.id}/phone`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to save phone");
      onSaved(row.id);
    } catch (reason) { setPhoneError((reason as Error).message); }
    finally { setSaving(false); }
  }
  const activePhone = hasValidPhone(row.phone_number);
  return <tr className="border-t border-prism-border/60 align-top hover:bg-slate-50/60"><td className="px-5 py-4"><input type="checkbox" checked={checked} onChange={onCheck} disabled={!activePhone} aria-label={`Select ${row.name}`} className="h-4 w-4 accent-prism-purple disabled:opacity-30" /></td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.name}</p><p className="mt-1 text-[10px] text-prism-muted">{row.submissions} submissions</p></td><td className="px-5 py-4"><p className="font-semibold text-prism-text">{row.market_name || "Unassigned market"}</p><p className="mt-1 text-[10px] text-prism-muted">{[row.region_name, row.district_name].filter(Boolean).join(" · ") || "No location"}</p></td><td className="px-5 py-4"><p className={row.last_login_at ? "text-prism-text" : "font-bold text-red-600"}>{row.last_login_at ? `Login ${date(row.last_login_at)}` : "Never logged in"}</p><p className="mt-1 text-[10px] text-prism-muted">{row.last_synced_at ? `Synced ${date(row.last_synced_at)}` : "Never synced"}</p></td><td className="min-w-64 px-5 py-4"><div className="flex gap-2"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0241234567" className="min-w-0 flex-1 rounded-lg border border-prism-border px-2.5 py-2 text-xs outline-none focus:border-prism-purple" /><button onClick={savePhone} disabled={saving || phone === (row.phone_number ?? "")} className="rounded-full bg-prism-teal px-3 py-2 text-[10px] font-black text-prism-text disabled:opacity-40">{saving ? "Saving" : "Save"}</button></div><p className={`mt-1 text-[10px] font-bold ${activePhone ? "text-emerald-600" : "text-amber-600"}`}>{activePhone ? "Active for SMS · automatically selected when saved" : "Add and save a valid number to activate"}</p>{phoneError && <p className="mt-1 text-[10px] text-red-600">{phoneError}</p>}</td><td className="px-5 py-4"><p className="font-bold text-prism-text">{row.sms_sent_count} sent</p><p className="mt-1 text-[10px] text-prism-muted">{row.last_sms_at ? date(row.last_sms_at) : "No alerts yet"}</p></td></tr>;
}

function hasValidPhone(value: string | null) { return /^233\d{9}$/.test(value ?? ""); }

function date(value: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-between border-t border-prism-border/60 px-5 py-4 text-xs text-prism-muted"><span>{total} readers · Page {page} of {pages}</span><div className="flex gap-2"><button onClick={() => onPage(Math.max(page - 1, 1))} disabled={page <= 1} className="rounded-full bg-prism-bg px-3 py-1.5 font-bold text-prism-purple disabled:opacity-40">Previous</button><button onClick={() => onPage(Math.min(page + 1, pages))} disabled={page >= pages} className="rounded-full bg-prism-bg px-3 py-1.5 font-bold text-prism-purple disabled:opacity-40">Next</button></div></div>;
}
