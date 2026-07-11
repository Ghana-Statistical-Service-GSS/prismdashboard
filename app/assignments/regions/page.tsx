"use client";

import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type RegionRow = {
  id: number;
  name: string;
  rs: string;
};

const regions: RegionRow[] = [
  { id: 1, name: "UPPER WEST", rs: "AHMED SALIM" },
  { id: 2, name: "GREATER ACCRA", rs: "YAKUB KARIM" },
  { id: 3, name: "ASHANTI", rs: "PAA KWESI" },
];

export default function RegionsAssignmentsPage() {
  const role: "HQ" | "RS" | "Supervisor" = "HQ";

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-10 py-8">
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-prism-text">
              REGIONS → REGIONAL STATISTICIANS
            </h1>
            <p className="mt-2 text-sm text-prism-muted">
              Assign Regional Statisticians to regions.
            </p>
          </header>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-4 py-3">Region</th>
                    <th className="px-4 py-3">Current RS</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.id} className="border-b border-prism-border/50 last:border-b-0">
                      <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                        {r.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-prism-text">
                        {r.rs}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {role === "HQ" ? (
                          <button
                            type="button"
                            onClick={() => {
                              console.log("Assign RS", r.id);
                            }}
                            className="rounded-full bg-[#221B51] px-4 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
                          >
                            Assign
                          </button>
                        ) : (
                          <span className="text-xs text-prism-muted">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              href="/assignments"
              className="mt-4 inline-flex rounded-full bg-[#221B51] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Back to Assignments
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
