"use client";

import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function ValidationStatusReportPage() {
  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-10 py-8">
          <header className="mb-6">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-prism-text">
              Validation Status
            </h1>
            <p className="mt-2 text-sm text-prism-muted">
              Approved, pending and rejected items across the system.
            </p>
          </header>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-prism-muted">
              Report visualization will be displayed here.
            </p>
            <Link
              href="/reports"
              className="mt-4 inline-flex rounded-full bg-[#221B51] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Back to Reports
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
