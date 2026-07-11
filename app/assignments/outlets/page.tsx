"use client";

import Image from "next/image";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { FilterBar } from "@/components/assignments/FilterBar";
import { OutletAssignmentTable } from "@/components/assignments/OutletAssignmentTable";
import { ItemAssignmentTable } from "@/components/assignments/ItemAssignmentTable";
import { AssignOutletReaderModal } from "@/components/assignments/AssignOutletReaderModal";
import { AssignItemReaderModal } from "@/components/assignments/AssignItemReaderModal";
import type { Outlet as OutletType } from "@/components/assignments/types";

type Outlet = OutletType & {
  marketId: string;
  readerIds?: string[];
};

type ItemRow = {
  id: number;
  name: string;
  brand: string;
  readers: string[];
};

const outlets: Outlet[] = [
  { id: "o-1", name: "OUTLET 1", marketId: "MAIN MARKET", region: "UPPER WEST", category: "Large", readerIds: ["READER A"] },
  { id: "o-2", name: "OUTLET 2", marketId: "MAIN MARKET", region: "UPPER WEST", category: "Medium", readerIds: ["READER B"] },
  { id: "o-3", name: "OUTLET 3", marketId: "NEW MARKET", region: "GREATER ACCRA", category: "Small", readerIds: [] },
];

const items: ItemRow[] = [
  { id: 1, name: "TOMATO", brand: "VEGETABLE", readers: ["READER A"] },
  { id: 2, name: "MAIZE", brand: "CEREAL", readers: ["READER B", "READER C"] },
  { id: 3, name: "PEPPER", brand: "SPICE", readers: [] },
];

export default function OutletsAssignmentsPage() {
  const [role] = useState<"HQ" | "RS" | "Supervisor">("HQ");
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);

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
                OUTLETS & ITEMS → MARKET READERS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                Assign outlets and items to market readers.
              </p>
            </div>
            <div className="relative h-28 w-48 md:h-32 md:w-56">
              <Image
                src="/outlet-assign-avatar.png"
                alt="Outlet assignments"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Filter bar */}
          <FilterBar
            leftLabel="56 OUTLETS"
            rightContent={
              <>
                <FilterSelect label="Region" onChange={(v) => handleFilter("Region", v)} />
                <FilterSelect label="District" onChange={(v) => handleFilter("District", v)} />
                <FilterSelect label="Market" onChange={(v) => handleFilter("Market", v)} />
                <FilterSelect label="Supervisor" onChange={(v) => handleFilter("Supervisor", v)} />
                <FilterSelect label="Market Reader" onChange={(v) => handleFilter("Market Reader", v)} />
              </>
            }
          />

          <div className="mt-8 space-y-6">
            {/* Outlet assignments */}
            <OutletAssignmentTable
              outlets={outlets}
              readOnly={role === "Supervisor"}
              onAssignClick={(outlet) => {
                if (role === "Supervisor") return;
                setSelectedOutlet(outlet);
              }}
            />

            {/* Item assignments */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-extrabold text-prism-text">Item Assignments</h3>
                <div className="flex flex-wrap gap-3">
                  <FilterSelect label="Market" onChange={(v) => handleFilter("Market", v)} />
                  <FilterSelect label="Market Reader" onChange={(v) => handleFilter("Market Reader", v)} />
                </div>
              </div>
              <ItemAssignmentTable
                items={items}
                readOnly={role === "Supervisor"}
                onAssignClick={(item) => {
                  if (role === "Supervisor") return;
                  setSelectedItem(item);
                }}
              />
            </div>
          </div>
        </main>
      </div>

      <AssignOutletReaderModal
        open={!!selectedOutlet}
        outlet={selectedOutlet}
        onClose={() => setSelectedOutlet(null)}
        onSave={(outletId, readers) => {
          console.log("Save outlet readers", { outletId, readers });
        }}
        role={role}
      />

      <AssignItemReaderModal
        open={!!selectedItem}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={(itemId, readers) => {
          console.log("Save item readers", { itemId, readers });
        }}
        role={role}
      />
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
