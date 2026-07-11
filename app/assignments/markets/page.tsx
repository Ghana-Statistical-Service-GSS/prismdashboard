"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { FilterBar } from "@/components/assignments/FilterBar";
import { MarketAssignmentTable } from "@/components/assignments/MarketAssignmentTable";
import { AssignSupervisorDrawer } from "@/components/assignments/AssignSupervisorDrawer";
import { Market } from "@/components/assignments/types";

const supervisors = [
  { id: "sup-a", name: "SUPERVISOR A" },
  { id: "sup-b", name: "SUPERVISOR B" },
  { id: "sup-c", name: "SUPERVISOR C" },
];

// Business rule:
// - Supervisor can supervise many markets
// - Market has only ONE supervisor
const markets: Market[] = [
  { id: "m-1", name: "MAIN MARKET", district: "WA MUNICIPAL", region: "UPPER WEST", supervisorId: "sup-a" },
  { id: "m-2", name: "NANDOM MARKET", district: "NANDOM", region: "UPPER WEST", supervisorId: "sup-b" },
  { id: "m-3", name: "NEW MARKET", district: "ACCRA", region: "GREATER ACCRA", supervisorId: undefined },
  { id: "m-4", name: "OLD MARKET", district: "KUMASI", region: "ASHANTI", supervisorId: "sup-c" },
];

export default function MarketsAssignmentsPage() {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [role] = useState<"HQ" | "RS" | "Supervisor">("HQ");

  const selectedMarket = useMemo(
    () => markets.find((m) => m.id === selectedMarketId) ?? null,
    [selectedMarketId]
  );

  const handleFilter = (label: string, value: string) => {
    console.log(`${label} filter:`, value);
  };

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-10 py-8">
          {/* Header */}
          <header className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-prism-text">
                MARKETS → SUPERVISORS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                Assign markets to supervisors for each region.
              </p>
            </div>
            <div className="relative h-28 w-48 md:h-32 md:w-56">
              <Image
                src="/market-assign-avatar.png"
                alt="Market assignments"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Filter bar */}
          <FilterBar
            leftLabel="24 MARKETS"
            rightContent={
              <>
                <FilterSelect label="Region" onChange={(v) => handleFilter("Region", v)} />
                <FilterSelect label="District" onChange={(v) => handleFilter("District", v)} />
                <FilterSelect label="Supervisor" onChange={(v) => handleFilter("Supervisor", v)} />
              </>
            }
          />

          {/* Two-column layout */}
          <div className="mt-8 flex flex-col gap-6 md:flex-row">
            <div className="md:w-2/3">
              <MarketAssignmentTable
                markets={markets}
                supervisors={supervisors}
                selectedMarketId={selectedMarketId}
                onSelectMarket={setSelectedMarketId}
                readOnly={role === "Supervisor"}
              />
            </div>

            <div className="md:w-1/3">
              <AssignSupervisorDrawer
                key={selectedMarket?.id ?? "no-market"}
                selectedMarket={selectedMarket}
                open={!!selectedMarket}
                onClose={() => setSelectedMarketId(null)}
                onSave={(marketId, supervisorId) => {
                  console.log("Save supervisor", { marketId, supervisorId });
                }}
                role={role}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  onChange: (value: string) => void;
};

function FilterSelect({ label, onChange }: FilterSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-prism-muted">
        {label}
      </span>
      <select
        className="rounded-full border border-prism-border bg-white px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All {label}</option>
        <option value="Option A">Option A</option>
        <option value="Option B">Option B</option>
      </select>
    </div>
  );
}
