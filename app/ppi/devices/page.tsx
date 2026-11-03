"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DeviceRebindingPanel } from "@/components/assignments/DeviceRebindingPanel";
import { ppiApi, PpiApiError } from "@/components/ppi/api";
import type { PpiPlaces } from "@/components/ppi/users/types";
import { loadDashboardUser } from "@/lib/dashboard-user-client";

type Locations = { regions: { id: string; name: string }[]; districts: { id: string; name: string; region_id: string }[]; markets: [] };

// PPI › Device bindings - let a PPI enumerator sign in on another phone
// (HQ / Admin). The same bindings and audit as Market Reading › Device
// Bindings, which lists CPI readers only.
export default function PpiDevicesPage() {
  const [data, setData] = useState<Locations | null>(null);
  const [isHq, setIsHq] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardUser()
      .then((user) => setIsHq(user.role === "HQ" || user.role === "ADMIN"))
      .catch(() => setIsHq(false));
    ppiApi<PpiPlaces>("/places")
      .then((places) => setData({
        regions: places.regions,
        districts: places.districts.map((d) => ({ id: d.id, name: d.name, region_id: d.regionId })),
        markets: [],
      }))
      .catch((reason) => setError(reason instanceof PpiApiError ? reason.message : "Unable to load regions"));
  }, []);

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">PPI Initiation</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">Device Bindings</h1>
            <p className="mt-2 max-w-3xl text-sm text-prism-muted">Each PPI enumerator account works on one phone. When an enumerator changes or reinstalls a phone, allow the new device here.</p>
          </header>
          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {(!data || isHq === null) && !error && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Loading…</div>}
          {data && isHq === false && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted">Only HQ and Admin can change device bindings.</div>}
          {data && isHq && (
            <DeviceRebindingPanel
              data={data}
              endpoint="/api/dashboard/ppi/device-bindings"
              title="PPI enumerator device bindings"
              description="Allow an enumerator to move to another phone. Unlocking immediately prevents the currently bound phone from syncing; the next successful sign-in on the PPI app becomes the active phone. Unsynced work on the old phone stays on it - sync it first if the phone still works."
              readerLabel="Enumerator"
              showMarket={false}
            />
          )}
        </main>
      </div>
    </div>
  );
}
