"use client";

import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { ppiKeys, STAGE_LABEL } from "./api";
import { usePpiQuery } from "./usePpiQuery";

// PPI › Data export: the submitted interviews as an Excel workbook
// (GET /api/v1/ppi/dashboard/data-export). The backend applies the scope:
// HQ/Admin national or one region, an RS always their own region; a
// Supervisor is refused (and does not see this page in the sidebar).

type ExportOptions = {
  scope: { level: "NATIONAL" | "REGION"; regionId: string | null; regionName: string | null };
  regions: { regionId: string; regionName: string }[];
  maxRows: number;
};

const STATUSES = [
  { value: "ALL", label: "All submitted", hint: "Every establishment submitted at least once, as last submitted." },
  { value: "APPROVED", label: "Approved", hint: "Final approval only." },
  { value: "SUBMITTED", label: "Under review", hint: "Waiting at a review stage." },
  { value: "RETURNED", label: "Returned", hint: "Returned for correction (the version that was returned)." },
  { value: "REMOVED", label: "Removed by HQ", hint: "Only establishments HQ removed from the round (left out of every other choice)." },
] as const;
const STAGES = ["", "SUPERVISOR", "RS", "HQ"] as const;
const FORMATS = [
  { value: "sheets", label: "Separate sheets", hint: "Establishments, major products, products, specifications, prices and quarterly revenue, one sheet each." },
  { value: "single", label: "One sheet", hint: "One row per specification with its establishment, major product and product; prices as columns." },
] as const;

const field = "mt-1 w-full rounded-2xl bg-white px-3 py-2.5 text-sm text-prism-text ring-1 ring-prism-border focus:outline-none focus:ring-2 focus:ring-prism-purple";
const labelStyle = "text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted";

export function DataExport() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [userError, setUserError] = useState("");
  const [regionId, setRegionId] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("ALL");
  const [stage, setStage] = useState<(typeof STAGES)[number]>("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("sheets");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    loadDashboardUser().then((u) => { if (active) setUser(u); }).catch(() => { if (active) setUserError("Your session could not be loaded. Sign in again."); });
    return () => { active = false; };
  }, []);

  const allowed = user ? user.role !== "SUPERVISOR" : false;
  const options = usePpiQuery<ExportOptions>(user && allowed ? ppiKeys.exportOptions(user.user_id) : null, user && allowed ? "/data-export/options" : null);
  const o = options.data;
  const national = o?.scope.level === "NATIONAL";

  const download = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    const params = new URLSearchParams({ format, status });
    if (status === "SUBMITTED" && stage) params.set("stage", stage);
    if (national && regionId) params.set("regionId", regionId);
    try {
      const response = await fetch(`/api/dashboard/ppi/data-export?${params}`, { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/"); return; }
      const type = response.headers.get("content-type") || "";
      // A refusal (too large, invalid choice, session) is JSON: show it rather
      // than saving it as a workbook.
      if (!response.ok || !type.startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || "The export could not be prepared.");
      }
      const name = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") || "")?.[1] || "ppi-initiation-export.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      // Revoked later: some browsers cancel a download whose URL goes in the same tick.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setOutcome({ tone: "ok", text: `Downloaded ${name}.` });
    } catch (error) {
      setOutcome({ tone: "error", text: error instanceof Error ? error.message : "The export could not be prepared." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-5">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-purple">PPI initiation</p>
        <h1 className="mt-1 text-2xl font-black text-prism-text">Data export</h1>
        <p className="mt-1 text-sm text-prism-muted">
          The interviews as last submitted by the enumerators, as an Excel workbook. Interviews never submitted are not included.
        </p>
      </header>

      {userError ? <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{userError}</p> : null}
      {user && !allowed ? (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          The data export is available to HQ, Admin and Regional Statisticians.
        </p>
      ) : null}
      {options.error ? <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{options.error}</p> : null}
      {allowed && !o && !options.error ? <p className="text-sm text-prism-muted">Loading…</p> : null}

      {o ? (
        <form onSubmit={download} className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prism-border/60">
          <div className="grid gap-4 sm:grid-cols-2">
            {national ? (
              <label className="block">
                <span className={labelStyle}>Region</span>
                <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={field}>
                  <option value="">All regions (national)</option>
                  {o.regions.map((r) => <option key={r.regionId} value={r.regionId}>{r.regionName}</option>)}
                </select>
              </label>
            ) : (
              <div>
                <span className={labelStyle}>Region</span>
                <p className="mt-1 rounded-2xl bg-prism-bg/70 px-3 py-2.5 text-sm font-bold text-prism-text">{o.scope.regionName ?? "Your region"}</p>
                <p className="mt-1 text-[11px] text-prism-muted">Regional Statisticians export their own region.</p>
              </div>
            )}
            <label className="block">
              <span className={labelStyle}>Status</span>
              <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setStage(""); }} className={field}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="mt-1 block text-[11px] text-prism-muted">{STATUSES.find((s) => s.value === status)?.hint}</span>
            </label>
            {status === "SUBMITTED" ? (
              <label className="block">
                <span className={labelStyle}>Review stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={field}>
                  {STAGES.map((s) => <option key={s || "any"} value={s}>{s ? `At ${STAGE_LABEL[s]} review` : "Any stage"}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <fieldset>
            <legend className={labelStyle}>Format</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={clsx("flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 focus-within:ring-2 focus-within:ring-prism-purple",
                    format === f.value ? "bg-prism-bg ring-prism-purple" : "ring-prism-border/70")}
                >
                  <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} className="mt-1 accent-prism-purple" />
                  <span>
                    <span className="block text-sm font-bold text-prism-text">{f.label}</span>
                    <span className="block text-xs text-prism-muted">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-prism-purple px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
              {busy ? "Preparing the workbook…" : "Download Excel workbook"}
            </button>
            <span className="text-[11px] text-prism-muted">
              Up to {o.maxRows.toLocaleString("en-GH")} rows a sheet; a larger export is refused, never cut: choose a region or a status.
            </span>
          </div>

          {outcome ? (
            <p role={outcome.tone === "error" ? "alert" : "status"} className={clsx("rounded-2xl p-3 text-sm font-semibold", outcome.tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800")}>
              {outcome.text}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
