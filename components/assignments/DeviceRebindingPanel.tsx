"use client";

import { useEffect, useState } from "react";
import { TablePagination } from "@/components/common/TablePagination";

// Market Reader device bindings (one account = one phone): HQ / Admin let a
// reader move to another phone. Used by Assignments (Market Initiation) and
// Market Reading > Device Bindings; both use the same bindings.
export type Option = { id: string; code?: string; name: string; region_id?: string; region_name?: string; district_id?: string; district_name?: string };
type Locations = { regions: Option[]; districts: Option[]; markets: Option[] };
type DeviceBinding = {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  is_active: boolean;
  market_id: string | null;
  market_name: string | null;
  district_id: string | null;
  district_name: string | null;
  region_id: string | null;
  region_name: string | null;
  device_id: string | null;
  binding_status: "ACTIVE" | "UNLOCKED" | "REVOKED" | "NEVER_BOUND";
  bound_at: string | null;
  last_seen_at: string | null;
  unlocked_at: string | null;
  unlock_reason: string | null;
  unlocked_by_name: string | null;
};

export function DeviceRebindingPanel({ data }: { data: Locations }) {
  const [rows, setRows] = useState<DeviceBinding[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 as 10 | 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [market, setMarket] = useState("");
  const [selected, setSelected] = useState<DeviceBinding | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  const districts = data.districts.filter((row) => !region || row.region_id === region);
  const markets = data.markets.filter((row) => (!region || row.region_id === region) && (!district || row.district_id === district));

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status) params.set("status", status);
    if (region) params.set("regionId", region);
    if (district) params.set("districtId", district);
    if (market) params.set("marketId", market);
    setLoading(true);
    setError("");
    fetch(`/api/dashboard/assignments/device-bindings?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load device bindings");
        setRows(body.rows || []);
        setPagination((current) => ({ ...current, ...body.pagination }));
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load device bindings");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [pagination.page, pagination.pageSize, debouncedSearch, status, region, district, market, refresh]);

  const unlock = async () => {
    if (!selected || reason.trim().length < 5) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/dashboard/assignments/device-bindings/${selected.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to allow device rebinding");
      setNotice(`${selected.name} can now sign in on another device.`);
      setSelected(null);
      setReason("");
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to allow device rebinding");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPage = () => setPagination((current) => ({ ...current, page: 1 }));
  return <section className="mt-6 overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
    <div className="border-b border-prism-border p-5">
      <div>
        <h2 className="font-black text-prism-text">Market Reader device bindings</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-prism-muted">Allow a reader to move to another phone. Unlocking immediately prevents the currently bound device from syncing; the next successful mobile login becomes the active device.</p>
      </div>
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</div>}
      <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        <input value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Reader, email, contact or market…" className="rounded-xl border border-prism-border px-3 py-2 text-xs" />
        <Select value={status} onChange={(value) => { setStatus(value); resetPage(); }} label="All binding statuses" options={bindingStatusOptions} />
        <Select value={region} onChange={(value) => { setRegion(value); setDistrict(""); setMarket(""); resetPage(); }} label="All regions" options={data.regions} />
        <Select value={district} onChange={(value) => { setDistrict(value); setMarket(""); resetPage(); }} label="All districts" options={districts} />
        <Select value={market} onChange={(value) => { setMarket(value); resetPage(); }} label="All markets" options={markets} />
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-prism-muted"><tr><th className="px-5 py-3">Market Reader</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Binding</th><th className="px-5 py-3">Bound / last active</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-prism-border/60">
          <td className="px-5 py-4"><b className="text-prism-text">{row.name}</b><p className="mt-0.5 text-prism-muted">{row.phone_number || row.email}</p>{!row.is_active && <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Account disabled</span>}</td>
          <td className="px-5 py-4"><b>{row.market_name || "Unassigned market"}</b><p className="mt-0.5 text-prism-muted">{[row.district_name, row.region_name].filter(Boolean).join(" · ") || "Location unavailable"}</p></td>
          <td className="px-5 py-4"><BindingBadge status={row.binding_status} /><p className="mt-2 font-mono text-[10px] text-prism-muted">{maskDeviceId(row.device_id)}</p>{row.binding_status === "UNLOCKED" && row.unlocked_by_name && <p className="mt-1 text-[10px] text-prism-muted">By {row.unlocked_by_name}</p>}</td>
          <td className="px-5 py-4 text-prism-muted"><p><b className="text-prism-text">Bound:</b> {formatDateTime(row.bound_at)}</p><p className="mt-1"><b className="text-prism-text">Active:</b> {formatDateTime(row.last_seen_at)}</p></td>
          <td className="px-5 py-4 text-right"><button disabled={!row.is_active || row.binding_status !== "ACTIVE"} onClick={() => { setSelected(row); setReason(""); setError(""); }} className="rounded-full border border-prism-purple px-3 py-2 font-bold text-prism-purple disabled:cursor-not-allowed disabled:border-prism-border disabled:text-prism-muted disabled:opacity-50">{row.binding_status === "ACTIVE" ? "Allow new device" : row.binding_status === "UNLOCKED" ? "Awaiting login" : "Unavailable"}</button></td>
        </tr>)}</tbody>
      </table>
      {!loading && rows.length === 0 && <p className="p-10 text-center text-sm text-prism-muted">No Market Readers match the selected filters.</p>}
      {loading && <p className="p-10 text-center text-sm text-prism-muted">Loading device bindings…</p>}
    </div>
    <TablePagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />
    {selected && <ModalShell title="Allow login on another device" subtitle="Review the existing binding and provide a reason" onClose={() => { if (!submitting) setSelected(null); }} locked={submitting}>
      <div className="grid gap-3 sm:grid-cols-2"><ReviewCard label="Market Reader" primary={selected.name} secondary={[selected.market_name, selected.district_name, selected.region_name].filter(Boolean).join(" · ")} /><ReviewCard label="Current device" primary={maskDeviceId(selected.device_id)} secondary={`Last active ${formatDateTime(selected.last_seen_at)}`} muted /></div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">The current phone will be disconnected immediately.</p><p className="mt-1 text-xs leading-5 text-amber-800">The reader must sign in on the intended phone. Whichever phone signs in first will become the new active device.</p></div>
      <label className="mt-5 block text-xs font-bold text-prism-muted">Reason for rebinding<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="For example: Reader replaced a damaged phone" className="mt-1 w-full resize-none rounded-xl border border-prism-border px-3 py-2 text-sm font-normal text-prism-text" /></label>
      <p className={`mt-1 text-[10px] ${reason.trim().length > 0 && reason.trim().length < 5 ? "text-red-600" : "text-prism-muted"}`}>Minimum 5 characters · {reason.length}/500</p>
      <ModalActions onCancel={() => setSelected(null)} cancelLabel="Cancel"><button disabled={submitting || reason.trim().length < 5} onClick={unlock} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{submitting ? "Unlocking…" : "Confirm device rebinding"}</button></ModalActions>
    </ModalShell>}
  </section>;
}

const bindingStatusOptions: Option[] = [
  { id: "ACTIVE", name: "Active" },
  { id: "UNLOCKED", name: "Awaiting new device" },
  { id: "REVOKED", name: "Revoked" },
  { id: "NEVER_BOUND", name: "Never bound" },
];

function BindingBadge({ status }: { status: DeviceBinding["binding_status"] }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    UNLOCKED: "bg-amber-50 text-amber-800",
    REVOKED: "bg-red-50 text-red-700",
    NEVER_BOUND: "bg-slate-100 text-slate-600",
  };
  const labels = { ACTIVE: "Active", UNLOCKED: "Awaiting new device", REVOKED: "Revoked", NEVER_BOUND: "Never bound" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}>{labels[status]}</span>;
}

function maskDeviceId(deviceId: string | null) {
  if (!deviceId) return "No device";
  if (deviceId.length <= 12) return deviceId;
  return `${deviceId.slice(0, 8)}…${deviceId.slice(-4)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export function ModalShell({ title, subtitle, onClose, locked, children }: { title: string; subtitle: string; onClose: () => void; locked: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose(); }}><div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-prism-border px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-prism-teal">Assignment change</p><h3 id="assignment-modal-title" className="mt-1 text-xl font-black text-prism-text">{title}</h3><p className="mt-1 text-xs text-prism-muted">{subtitle}</p></div><button disabled={locked} onClick={onClose} aria-label="Close modal" className="rounded-full border border-prism-border px-3 py-1.5 text-sm font-bold text-prism-muted disabled:opacity-40">×</button></div><div className="p-6">{children}</div></div></div>;
}

export function ReviewCard({ label, primary, secondary, muted = false }: { label: string; primary: string; secondary: string; muted?: boolean }) { return <div className={`rounded-2xl border p-4 ${muted ? "border-slate-200 bg-slate-50" : "border-prism-teal/30 bg-teal-50/60"}`}><p className="text-[10px] font-bold uppercase tracking-wider text-prism-muted">{label}</p><p className="mt-2 text-sm font-black text-prism-text">{primary}</p><p className="mt-1 text-xs text-prism-muted">{secondary}</p></div>; }
export function ModalActions({ onCancel, cancelLabel = "Cancel", children }: { onCancel: () => void; cancelLabel?: string; children: React.ReactNode }) { return <div className="mt-6 flex items-center justify-end gap-2"><button onClick={onCancel} className="rounded-full border border-prism-border px-5 py-2.5 text-xs font-bold text-prism-muted">{cancelLabel}</button>{children}</div>; }

export function Select({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Option[] }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-xs text-prism-text"><option value="">{label}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>; }
