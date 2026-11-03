"use client";

import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { formatDateTime, ppiApi, PpiApiError, ppiKeys } from "../api";
import { invalidatePpi, usePpiQuery } from "../usePpiQuery";
import { TableSearch } from "@/components/common/TableSearch";
import { TablePagination } from "@/components/common/TablePagination";
import { ROLE_LABEL, type PpiPlaces, type PpiRole, type PpiUser, type PpiUserList } from "./types";

const ROLES: PpiRole[] = ["MARKET_READER", "SUPERVISOR", "REGIONAL_STATISTICIAN"];
const DEVICE_LABEL: Record<NonNullable<PpiUser["device"]>["status"], string> = {
  ACTIVE: "Phone bound", UNLOCKED: "Awaiting new phone", REVOKED: "Phone revoked", NEVER_BOUND: "Not signed in yet",
};
const DEVICE_STYLE: Record<NonNullable<PpiUser["device"]>["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700", UNLOCKED: "bg-amber-50 text-amber-800", REVOKED: "bg-red-50 text-red-700", NEVER_BOUND: "bg-slate-100 text-slate-600",
};

// PPI › Users: PPI enumerators, Supervisors and Regional Statisticians.
// HQ/Admin list, create, activate and deactivate them; a PPI Regional
// Statistician sees their own region read only (the backend applies scope).
export function PpiUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [region, setRegion] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20>(20);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<PpiUser | null>(null);
  const [notice, setNotice] = useState("");

  const params = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
    ...(search.trim() ? { search: search.trim() } : {}), ...(role ? { role } : {}), ...(region ? { regionId: region } : {}), ...(active ? { active } : {}),
  }).toString();
  const list = usePpiQuery<PpiUserList>(ppiKeys.users(params), `/users?${params}`);
  const places = usePpiQuery<PpiPlaces>(ppiKeys.places(), "/places");
  const rows = list.data?.items ?? [];
  const canManage = list.data?.canManage ?? false;
  const national = list.data?.scope.level === "NATIONAL";
  const reset = () => setPage(1);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">PPI Initiation</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Users</h1>
          <p className="mt-2 max-w-3xl text-sm text-prism-muted">PPI enumerators, Supervisors and Regional Statisticians. HQ and Admin work in both programmes and are not listed.</p>
        </div>
        {canManage && (
          <button type="button" onClick={() => { setAdding(true); setNotice(""); }} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110">
            + Add PPI user
          </button>
        )}
      </header>

      {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</div>}
      {(list.error || places.error) && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{list.error || places.error}</div>}

      <div className="overflow-hidden rounded-3xl border border-prism-border/70 bg-white shadow-sm">
        <div className="grid gap-2 border-b border-prism-border p-5 md:grid-cols-2 xl:grid-cols-4">
          <TableSearch value={search} onChange={(value) => { setSearch(value); reset(); }} placeholder="Name, email or phone" />
          <FilterSelect label="All roles" value={role} onChange={(value) => { setRole(value); reset(); }} options={ROLES.map((r) => ({ id: r, name: ROLE_LABEL[r] }))} />
          {national && <FilterSelect label="All regions" value={region} onChange={(value) => { setRegion(value); reset(); }} options={places.data?.regions ?? []} />}
          <FilterSelect label="Active and inactive" value={active} onChange={(value) => { setActive(value); reset(); }} options={[{ id: "true", name: "Active" }, { id: "false", name: "Inactive" }]} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-prism-muted">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last sign-in</th>
                <th className="px-5 py-3">Phone (app)</th>
                <th className="px-5 py-3 text-right">Assignments</th>
                {canManage && <th className="px-5 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.userId} className="border-t border-prism-border/60 align-top">
                  <td className="px-5 py-4"><b className="text-prism-text">{u.fullName}</b><p className="mt-0.5 text-prism-muted">{u.email}</p><p className="text-prism-muted">{u.phoneNumber || "No contact number"}</p></td>
                  <td className="px-5 py-4 font-semibold text-prism-text">{ROLE_LABEL[u.role]}</td>
                  <td className="px-5 py-4"><b className="text-prism-text">{u.regionName || "No region"}</b>{u.districtName && <p className="mt-0.5 text-prism-muted">{u.districtName}</p>}</td>
                  <td className="px-5 py-4"><span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{u.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-4 text-prism-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                  <td className="px-5 py-4">{u.device ? <><span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", DEVICE_STYLE[u.device.status])}>{DEVICE_LABEL[u.device.status]}</span>{u.device.lastSeenAt && <p className="mt-1 text-[10px] text-prism-muted">Active {formatDateTime(u.device.lastSeenAt)}</p>}</> : <span className="text-prism-muted">Dashboard only</span>}</td>
                  <td className="px-5 py-4 text-right font-bold text-prism-text">{u.activeAssignments}</td>
                  {canManage && (
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => { setConfirming(u); setNotice(""); }} className={clsx("rounded-full border px-3 py-2 font-bold", u.isActive ? "border-rose-300 text-rose-700" : "border-prism-purple text-prism-purple")}>
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!list.loading && list.data && rows.length === 0 && <p className="p-10 text-center text-sm text-prism-muted">No PPI users match the selected filters.</p>}
          {list.loading && <p className="p-10 text-center text-sm text-prism-muted">Loading PPI users…</p>}
        </div>
        <TablePagination page={page} pageSize={pageSize} total={list.data?.total ?? 0} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>

      {adding && places.data && (
        <AddPpiUser places={places.data} onClose={() => setAdding(false)} onCreated={(user) => { setAdding(false); setNotice(`${user.fullName} (${ROLE_LABEL[user.role]}) was created. Share the initial password with them securely.`); invalidatePpi("ppi:users"); }} />
      )}
      {confirming && (
        <ConfirmStatus user={confirming} onClose={() => setConfirming(null)} onDone={(user) => { setConfirming(null); setNotice(`${user.fullName} is now ${user.isActive ? "active" : "inactive"}.`); invalidatePpi("ppi:users"); }} />
      )}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="rounded-xl border border-prism-border bg-white px-3 py-2 text-sm text-prism-text">
      <option value="">{label}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function Modal({ title, subtitle, onClose, locked, children }: { title: string; subtitle: string; onClose: () => void; locked: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="ppi-user-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-prism-border px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-prism-teal">PPI accounts</p>
            <h3 id="ppi-user-modal-title" className="mt-1 text-xl font-black text-prism-text">{title}</h3>
            <p className="mt-1 text-xs text-prism-muted">{subtitle}</p>
          </div>
          <button type="button" disabled={locked} onClick={onClose} aria-label="Close" className="rounded-full border border-prism-border px-3 py-1.5 text-sm font-bold text-prism-muted disabled:opacity-40">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// A random initial password HQ can hand over (10 characters, no look-alikes).
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function AddPpiUser({ places, onClose, onCreated }: { places: PpiPlaces; onClose: () => void; onCreated: (user: PpiUser) => void }) {
  const [role, setRole] = useState<PpiRole>("MARKET_READER");
  const [regionId, setRegionId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const districts = places.districts.filter((d) => d.regionId === regionId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const { user } = await ppiApi<{ user: PpiUser }>("/users", {
        method: "POST",
        body: {
          fullName: form.get("fullName"), email: form.get("email"), phoneNumber: form.get("phoneNumber"), role, password,
          regionId: regionId || null, districtId: role === "MARKET_READER" ? form.get("districtId") || null : null,
        },
      });
      onCreated(user);
    } catch (reason) {
      if (reason instanceof PpiApiError) {
        setError(reason.message);
        setFieldErrors(Object.fromEntries((reason.errors ?? []).map((e) => [e.field, e.message])));
      } else {
        setError("The user could not be created.");
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name: string) => fieldErrors[name] && <span className="mt-1 block text-[11px] font-semibold text-red-600">{fieldErrors[name]}</span>;
  const inputClass = (name: string) => clsx("mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal text-prism-text", fieldErrors[name] ? "border-red-400" : "border-prism-border");
  return (
    <Modal title="Add a PPI user" subtitle="The account works in the PPI programme only. Enumerators sign in on the PPI phone app; Supervisors and Regional Statisticians on this dashboard." onClose={onClose} locked={busy}>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-bold text-prism-muted">Role
          <select value={role} onChange={(event) => setRole(event.target.value as PpiRole)} className={inputClass("role")}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>{fieldError("role")}
        </label>
        <label className="text-xs font-bold text-prism-muted">Full name<input name="fullName" required maxLength={200} autoComplete="off" className={inputClass("fullName")} />{fieldError("fullName")}</label>
        <label className="text-xs font-bold text-prism-muted">Official email<input name="email" type="email" required autoComplete="off" className={inputClass("email")} />{fieldError("email")}</label>
        <label className="text-xs font-bold text-prism-muted">Contact number<input name="phoneNumber" type="tel" required placeholder="0241234567" className={inputClass("phoneNumber")} />{fieldError("phoneNumber")}</label>
        <label className="text-xs font-bold text-prism-muted">Region
          <select value={regionId} onChange={(event) => setRegionId(event.target.value)} required className={inputClass("regionId")}>
            <option value="">Select region</option>
            {places.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>{fieldError("regionId")}
        </label>
        {role === "MARKET_READER" ? (
          <label className="text-xs font-bold text-prism-muted">District (optional)
            <select key={regionId} name="districtId" disabled={!regionId} defaultValue="" className={inputClass("districtId")}>
              <option value="">{regionId ? "No district" : "Select a region first"}</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>{fieldError("districtId")}
          </label>
        ) : <div className="hidden md:block" />}
        <label className="text-xs font-bold text-prism-muted md:col-span-2">Initial password
          <div className="mt-1 flex gap-2">
            <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={clsx(inputClass("password"), "mt-0 font-mono")} />
            <button type="button" onClick={() => setPassword(generatePassword())} className="shrink-0 rounded-xl border border-prism-border px-3 text-xs font-bold text-prism-purple">Generate</button>
          </div>
          <span className="mt-1 block text-[11px] font-normal text-prism-muted">At least 8 characters. Give it to the user privately.</span>
          {fieldError("password")}
        </label>
        <p className="text-[11px] text-prism-muted md:col-span-2">No market is needed: PPI enumerators work on the establishments assigned to them.</p>
        <div className="flex items-center justify-end gap-2 md:col-span-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-5 py-2.5 text-xs font-bold text-prism-muted">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Creating…" : "Create PPI user"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmStatus({ user, onClose, onDone }: { user: PpiUser; onClose: () => void; onDone: (user: PpiUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deactivating = user.isActive;
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await ppiApi<{ user: PpiUser }>(`/users/${user.userId}/status`, { method: "PATCH", body: { isActive: !deactivating } });
      onDone(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={deactivating ? "Deactivate this account?" : "Activate this account?"} subtitle={`${user.fullName} · ${ROLE_LABEL[user.role]}`} onClose={onClose} locked={busy}>
      {error && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
      <p className="text-sm text-prism-text">
        {deactivating
          ? "The user is signed out everywhere at once and cannot sign in until the account is activated again. An account still named on active PPI assignments cannot be deactivated: reassign those establishments first."
          : "The user can sign in again with their current password."}
      </p>
      {deactivating && user.activeAssignments > 0 && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Named on {user.activeAssignments} active assignment{user.activeAssignments === 1 ? "" : "s"}.</p>}
      <div className="mt-6 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-5 py-2.5 text-xs font-bold text-prism-muted">Cancel</button>
        <button type="button" onClick={run} disabled={busy} className={clsx("rounded-full px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50", deactivating ? "bg-rose-600" : "bg-prism-purple")}>{busy ? "Saving…" : deactivating ? "Deactivate" : "Activate"}</button>
      </div>
    </Modal>
  );
}
