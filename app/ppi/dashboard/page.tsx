"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PpiDashboard } from "@/components/ppi/dashboard/PpiDashboard";

// PPI › Dashboard. Filters and the drill path are in the address (read with
// useSearchParams, hence the Suspense boundary).
export default function PpiDashboardPage() {
  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <Suspense fallback={<div className="rounded-3xl bg-white p-10 text-center text-sm text-prism-muted shadow-sm">Loading PPI figures…</div>}>
            <PpiDashboard />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
