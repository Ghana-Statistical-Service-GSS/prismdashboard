"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ProgressCircle } from "@/components/common/ProgressCircle";
import { DecisionModal } from "@/components/validation/DecisionModal";
import { BulkDecisionModal } from "@/components/validation/BulkDecisionModal";

type ValidationItem = {
  id: number;
  name: string;
  code: string;
  brand: string;
  updatedAt: string;
  image: string;
  prevPrice: number;
  currentPrice: number;
  region: string;
  market: string;
  outlet: string;
  district: string;
  marketReader: string;
  supervisor: string;
  percentChange: number;
};

const baseItems = [
  {
    id: 1,
    name: "TOMATO",
    code: "3737398",
    brand: "VEGETABLE",
    updatedAt: "TODAY",
    image: "/items/tomato.jpg",
    prevPrice: 10,
    currentPrice: 15,
    region: "Upper West",
    market: "Main Market",
    outlet: "Outlet 1",
    district: "Wa Municipal",
    marketReader: "John Doe",
    supervisor: "Jane Smith",
  },
  {
    id: 2,
    name: "MAIZE",
    code: "3737398",
    brand: "CEREAL",
    updatedAt: "TODAY",
    image: "/items/maize.jpg",
    prevPrice: 20,
    currentPrice: 18,
    region: "Northern",
    market: "West Market",
    outlet: "Outlet 2",
    district: "Tamale",
    marketReader: "Abena Mensah",
    supervisor: "Kofi Mensah",
  },
  {
    id: 3,
    name: "PEPPER",
    code: "3737398",
    brand: "SPICE",
    updatedAt: "TODAY",
    image: "/items/pepper.jpg",
    prevPrice: 12,
    currentPrice: 22,
    region: "Greater Accra",
    market: "New Market",
    outlet: "Outlet 3",
    district: "Accra",
    marketReader: "Yaw Boateng",
    supervisor: "Ama Adjei",
  },
  {
    id: 4,
    name: "PARACETAMOL",
    code: "3737398",
    brand: "ANTIBIOTIC",
    updatedAt: "TODAY",
    image: "/items/paracetamol.jpg",
    prevPrice: 8,
    currentPrice: 10,
    region: "Ashanti",
    market: "Old Market",
    outlet: "Outlet 4",
    district: "Kumasi",
    marketReader: "Kojo Agyeman",
    supervisor: "Efua Owusu",
  },
];

const items: ValidationItem[] = baseItems.map((item) => {
  const percentChange = ((item.currentPrice - item.prevPrice) / item.prevPrice) * 100;
  return { ...item, percentChange };
});

export default function ValidationPage() {
  const [region, setRegion] = useState("All");
  const [district, setDistrict] = useState("All");
  const [market, setMarket] = useState("All");
  const [outlet, setOutlet] = useState("All");
  const [supervisor, setSupervisor] = useState("All");
  const [marketReader, setMarketReader] = useState("All");
  const [activeItem, setActiveItem] = useState<ValidationItem | null>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkMode, setBulkMode] = useState<"approve" | "reject" | null>(null);

  const unique = (key: keyof ValidationItem) =>
    Array.from(new Set(items.map((i) => i[key] as string)));

  const regions = useMemo(() => unique("region"), []);
  const districts = useMemo(() => unique("district"), []);
  const markets = useMemo(() => unique("market"), []);
  const outlets = useMemo(() => unique("outlet"), []);
  const supervisors = useMemo(() => unique("supervisor"), []);
  const readers = useMemo(() => unique("marketReader"), []);

  const filteredItems = items.filter((item) => {
    return (
      (region === "All" || item.region === region) &&
      (district === "All" || item.district === district) &&
      (market === "All" || item.market === market) &&
      (outlet === "All" || item.outlet === outlet) &&
      (supervisor === "All" || item.supervisor === supervisor) &&
      (marketReader === "All" || item.marketReader === marketReader)
    );
  });

  const visibleIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.includes(id)) && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-8">
            <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-prism-text sm:text-4xl md:text-5xl">
                  VALIDATION
                </h1>
                <p className="mt-2 text-sm text-prism-muted">
                  You can validate and manage all items here
                </p>
              </div>
              <div className="relative h-32 w-56 md:h-40 md:w-64">
                <Image
                  src="/validation-avatar.png"
                  alt="Validation"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </header>

            <section className="mt-10">
              <div className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
                <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                  {filteredItems.length} ITEMS
                </p>
              </div>
            </section>

            <section className="mt-6">
              <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white px-6 py-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
                <SelectFilter label="Region" value={region} onChange={setRegion} options={regions} placeholder="All Regions" />
                <SelectFilter label="District" value={district} onChange={setDistrict} options={districts} placeholder="All Districts" />
                <SelectFilter label="Market" value={market} onChange={setMarket} options={markets} placeholder="All Markets" />
                <SelectFilter label="Outlet" value={outlet} onChange={setOutlet} options={outlets} placeholder="All Outlets" />
                <SelectFilter label="Supervisor" value={supervisor} onChange={setSupervisor} options={supervisors} placeholder="All Supervisors" />
                <SelectFilter label="Market Reader" value={marketReader} onChange={setMarketReader} options={readers} placeholder="All Readers" />
              </div>
            </section>

            {selectedIds.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm text-prism-text">
                  <span className="font-semibold">{selectedIds.length} item(s) selected</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkMode("approve")}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkMode("reject")}
                      className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      Reject Selected
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-8">
              <div className="overflow-x-auto max-w-full rounded-3xl bg-white shadow-sm">
                <table className="min-w-[1100px] w-full table-auto text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-prism-border/70 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-prism-muted">
                    <tr>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Picture</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Item</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Description</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Region</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Market</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Outlet</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Market Reader</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Supervisor</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Prev Price</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">Current Price</th>
                      <th className="px-3 py-3 sm:px-4 sm:py-4">% Change</th>
                      <th className="px-3 py-3 text-center sm:px-4 sm:py-4">Approve</th>
                      <th className="px-3 py-3 text-center sm:px-4 sm:py-4">Disapprove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="border-b border-prism-border/50 last:border-b-0">
                        <td className="px-3 py-3 sm:px-4 sm:py-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-4">
                          <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-prism-bg">
                            <Image src={item.image} alt={item.name} fill className="object-contain" />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.name}
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.code}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.region}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.market}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.outlet}
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.marketReader}
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.supervisor}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.prevPrice.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-prism-text sm:px-4 sm:py-4 sm:text-sm">
                          {item.currentPrice.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-4">
                          <ProgressCircle
                            percent={item.percentChange}
                            size={48}
                            strokeWidth={4}
                            colorPositive="#14B8A6"
                            colorNegative="#EF4444"
                          />
                        </td>
                        <td className="px-3 py-3 text-center sm:px-4 sm:py-4">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                            aria-label={`Approve ${item.name}`}
                            onClick={() => {
                              setActiveItem(item);
                              setModalMode("approve");
                            }}
                          >
                            ✓
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center sm:px-4 sm:py-4">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                            aria-label={`Disapprove ${item.name}`}
                            onClick={() => {
                              setActiveItem(item);
                              setModalMode("reject");
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <DecisionModal
              isOpen={!!activeItem}
              mode={modalMode}
              itemName={activeItem?.name}
              itemId={activeItem?.id}
              onClose={() => {
                setActiveItem(null);
                setModalMode(null);
              }}
            />
            <BulkDecisionModal
              isOpen={bulkMode !== null && selectedIds.length > 0}
              mode={bulkMode}
              count={selectedIds.length}
              ids={selectedIds}
              onClose={() => {
                setBulkMode(null);
                setSelectedIds([]);
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

type SelectFilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
};

function SelectFilter({ label, value, onChange, options, placeholder }: SelectFilterProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        className="mt-2 w-full rounded-full border border-prism-border bg-white px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="All">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
