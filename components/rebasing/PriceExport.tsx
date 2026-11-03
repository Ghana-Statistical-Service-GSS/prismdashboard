"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { DashboardUser } from "@/lib/auth";
import { Period, periodLabel } from "./api";
import { useRebasingQuery } from "./useRebasingQuery";

// Market Reading › Reports › Export prices: one month's prices as CSV, for a
// region, a market or a Supervisor's markets, by review status. The backend
// applies the caller's scope (Supervisor: own markets, RS: region, HQ:
// national) whatever is chosen here; these choices only narrow it.

type PlaceOptions = {
  scope: "MARKETS" | "REGION" | "NATIONAL";
  regions: { region_id: string; region_name: string }[];
  markets: { market_id: string; market_name: string; region_id: string }[];
};
type SupervisorOption = { user_id: string; full_name: string; is_active: boolean; market_count: number; regions: string[] };

const STATUS_OPTIONS: [string, string][] = [
  ["ALL", "All prices"],
  ["FINAL_APPROVED", "Approved (final)"],
  ["PENDING", "Pending review (any stage)"],
  ["PENDING_SUPERVISOR", "Waiting for Supervisor"],
  ["PENDING_RS", "Waiting for Regional Statistician"],
  ["PENDING_HQ", "Waiting for HQ"],
  ["REJECTED", "Rejected"],
  ["CORRECTED", "Corrected after a rejection"],
];

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

function fileNameFrom(disposition: string | null) {
  const match = /filename="([^"]+)"/.exec(disposition || "");
  return match ? match[1] : "market-reading-prices.csv";
}

function Select({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (value: string) => void; options: [string, string][]; allLabel?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-prism-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full truncate rounded-xl border border-prism-border bg-white px-3 py-2 text-xs font-bold text-prism-text outline-none focus:border-prism-purple">
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

export function PriceExport({ periods, defaultPeriodId, user }: { periods: Period[]; defaultPeriodId: string | null; user: DashboardUser | null }) {
  const [chosenPeriod, setChosenPeriod] = useState<string | null>(null);
  const periodId = chosenPeriod ?? defaultPeriodId;
  // One place at a time: a region (and optionally one of its markets), or a Supervisor.
  const [regionId, setRegionId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const optionParams = new URLSearchParams(periodId ? { periodId } : {});
  if (regionId) optionParams.set("regionId", regionId);
  const options = useRebasingQuery<PlaceOptions>(periodId ? `/price-reviews/filters?${optionParams}` : null);
  const isSupervisor = user?.role === "SUPERVISOR";
  const supervisors = useRebasingQuery<{ supervisors: SupervisorOption[] }>(user && !isSupervisor ? "/exports/supervisors" : null);
  const scope = options.data?.scope;
  const markets = options.data?.markets || [];
  const busy = progress !== null;

  const choose = (place: "period" | "region" | "market" | "supervisor", value: string) => {
    setError("");
    setNotice("");
    if (place === "period") { setChosenPeriod(value); setRegionId(""); setMarketId(""); return; }
    if (place === "region") { setRegionId(value); setMarketId(""); setSupervisorId(""); return; }
    if (place === "market") { setMarketId(value); setSupervisorId(""); return; }
    setSupervisorId(value);
    setRegionId("");
    setMarketId("");
  };

  // Read the stream here rather than navigating to it, so a refused request
  // shows its reason on the page instead of saving an error as the file.
  const download = async () => {
    if (!periodId || busy) return;
    const params = new URLSearchParams({ periodId, status });
    if (supervisorId) params.set("supervisorId", supervisorId);
    else {
      if (regionId) params.set("regionId", regionId);
      if (marketId) params.set("marketId", marketId);
    }
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setNotice("");
    setProgress(0);
    let started = false;
    try {
      const response = await fetch(`/api/dashboard/rebasing/exports/prices.csv?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || `The download could not be prepared (HTTP ${response.status}).`);
      }
      started = true;
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        setProgress(received);
      }
      const fileName = fileNameFrom(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(new Blob(chunks, { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice(`Downloaded ${fileName} (${megabytes(received)}).`);
    } catch (reason) {
      if (controller.signal.aborted) setNotice("Download cancelled.");
      // A failure after the file started means the server cut it short: never save a partial file.
      else if (started) setError("The download was interrupted before it finished, so nothing was saved. Please try again.");
      else setError(reason instanceof Error && reason.message !== "Failed to fetch" ? reason.message : "The Market Reading service could not be reached. Please try again.");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  const scopeHint = isSupervisor ? "your markets" : user?.role === "REGIONAL_STATISTICIAN" ? (user.region_name || "your region") : "any region";
  return (
    <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="price-export-title">
      <div className="mb-4">
        <h2 id="price-export-title" className="text-base font-black text-prism-text">Export prices</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-prism-muted">
          {`Every price of the month for ${scopeHint}, with its review decisions - as CSV. The first 33 columns match the initiation export.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select label="Month" value={periodId ?? ""} onChange={(value) => choose("period", value)}
          options={periods.map((p) => [p.period_id, `${periodLabel(p)}${p.status === "CLOSED" ? " (closed)" : ""}`])} />
        {scope === "NATIONAL" && (
          <Select label="Region" value={regionId} onChange={(value) => choose("region", value)} allLabel="All regions"
            options={(options.data?.regions || []).map((r) => [r.region_id, r.region_name])} />
        )}
        {(scope !== "MARKETS" || markets.length > 1) && (
          <Select label="Market" value={marketId} onChange={(value) => choose("market", value)} allLabel={regionId ? "All markets in the region" : "All markets"}
            options={markets.map((m) => [m.market_id, m.market_name])} />
        )}
        {!isSupervisor && (
          <Select label="Supervisor" value={supervisorId} onChange={(value) => choose("supervisor", value)} allLabel="Any Supervisor"
            options={(supervisors.data?.supervisors || []).map((s) => [s.user_id,
              `${s.full_name}${scope === "NATIONAL" && s.regions.length ? ` · ${s.regions.join(", ")}` : ""}${s.is_active ? "" : " (inactive)"}`])} />
        )}
        <Select label="Status" value={status} onChange={(value) => { setStatus(value); setError(""); setNotice(""); }} options={STATUS_OPTIONS} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void download()} disabled={!periodId || busy}
          className="rounded-full bg-prism-teal px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Downloading…" : "Download CSV"}
        </button>
        {busy && (
          <>
            <span className="text-xs font-bold text-prism-muted" aria-live="polite">{progress ? `${megabytes(progress)} received` : "Preparing…"}</span>
            <button type="button" onClick={() => abort.current?.abort()} className="rounded-full border border-prism-border px-4 py-2 text-xs font-bold text-prism-text hover:bg-prism-bg">
              Cancel
            </button>
          </>
        )}
        {notice && !busy && <span className={clsx("text-xs font-bold", notice.startsWith("Downloaded") ? "text-emerald-700" : "text-prism-muted")} aria-live="polite">{notice}</span>}
      </div>
      {(options.error || supervisors.error) && <p className="mt-3 text-xs text-amber-700">{`Some choices could not be loaded: ${options.error || supervisors.error}`}</p>}
      {error && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
