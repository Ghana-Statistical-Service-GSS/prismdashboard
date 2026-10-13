"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DeviceRebindingPanel, type Option } from "@/components/assignments/DeviceRebindingPanel";

type Locations = { scope: { role: string }; regions: Option[]; districts: Option[]; markets: Option[] };

// Market Reading › Device Bindings - let a reader log in on another phone
// (HQ / Admin). The same bindings as Assignments › Device Rebinding.
export default function MarketReadingDevicesPage() {
  const [data, setData] = useState<Locations | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/assignments", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Unable to load markets");
        setData(body);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load markets"));
  }, []);

  const isHq = data?.scope.role === "HQ" || data?.scope.role === "ADMIN";
  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Market Reading</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Device Bindings</h1>
            <p className="mt-2 max-w-3xl text-sm text-prism-muted">Each Market Reader account works on one phone. When a reader changes or reinstalls a phone, allow the new device here.</p>
          </header>
          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {!data && !error && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Loading…</div>}
          {data && !isHq && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Only HQ and Admin can change device bindings.</div>}
          {data && isHq && <DeviceRebindingPanel data={data} />}
        </main>
      </div>
    </div>
  );
}
