"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ChangeRing } from "@/components/validation/ChangeRing";
import { DecisionModal } from "@/components/validation/DecisionModal";
import { BulkDecisionModal } from "@/components/validation/BulkDecisionModal";

type ThresholdItem = {
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
    prevPrice: 5.0,
    currentPrice: 1.0,
    region: "UPPER WEST",
    district: "WA MUNICIPAL",
    market: "MAIN MARKET",
    outlet: "OUTLET 1",
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
    prevPrice: 12.0,
    currentPrice: 6.0,
    region: "NORTHERN",
    district: "TAMALE",
    market: "WEST MARKET",
    outlet: "OUTLET 2",
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
    prevPrice: 10.0,
    currentPrice: 16.0,
    region: "GREATER ACCRA",
    district: "ACCRA",
    market: "NEW MARKET",
    outlet: "OUTLET 3",
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
    prevPrice: 3.0,
    currentPrice: 5.0,
    region: "ASHANTI",
    district: "KUMASI",
    market: "OLD MARKET",
    outlet: "OUTLET 4",
    marketReader: "Kojo Agyeman",
    supervisor: "Efua Owusu",
  },
];

const itemsWithPercent: ThresholdItem[] = baseItems.map((item) => {
  const percentChange = ((item.currentPrice - item.prevPrice) / item.prevPrice) * 100;
  return { ...item, percentChange };
});

const thresholdItems = itemsWithPercent.filter(
  (item) => Math.abs(item.percentChange) > 50
);

export default function ThresholdExceptionPage() {
  const [region, setRegion] = useState("All");
  const [district, setDistrict] = useState("All");
  const [market, setMarket] = useState("All");
  const [outlet, setOutlet] = useState("All");
  const [supervisor, setSupervisor] = useState("All");
  const [marketReader, setMarketReader] = useState("All");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeItem, setActiveItem] = useState<ThresholdItem | null>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | null>(null);
  const [bulkAllMode, setBulkAllMode] = useState<"approve" | "reject" | null>(null);

  const unique = (key: keyof ThresholdItem) =>
    Array.from(new Set(thresholdItems.map((i) => i[key] as string)));

  const regions = useMemo(() => unique("region"), []);
  const districts = useMemo(() => unique("district"), []);
  const markets = useMemo(() => unique("market"), []);
  const outlets = useMemo(() => unique("outlet"), []);
  const supervisors = useMemo(() => unique("supervisor"), []);
  const readers = useMemo(() => unique("marketReader"), []);

  const filteredItems = thresholdItems.filter((item) => {
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

  const handleBulkAllConfirm = (comment: string, mode: "approve" | "reject") => {
    console.log({
      action: mode === "approve" ? "approve-all-threshold" : "reject-all-threshold",
      ids: filteredItems.map((i) => i.id),
      comment,
    });
    setSelectedIds([]);
    setBulkAllMode(null);
  };

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-8">
          {/* Header */}
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-prism-text sm:text-4xl md:text-5xl">
                THRESHOLD EXCEPTION (PRICE)
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can review and manage items with exceptional price changes here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/validation-avatar.png"
                alt="Threshold exception"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Count */}
          <section className="mt-10">
            <div className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {filteredItems.length} ITEMS
              </p>
            </div>
          </section>

          {/* Filters */}
          <section className="mt-6">
            <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white px-6 py-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
              <SelectFilter
                label="Region"
                value={region}
                onChange={setRegion}
                options={regions}
                placeholder="All Regions"
              />
              <SelectFilter
                label="District"
                value={district}
                onChange={setDistrict}
                options={districts}
                placeholder="All Districts"
              />
              <SelectFilter
                label="Market"
                value={market}
                onChange={setMarket}
                options={markets}
                placeholder="All Markets"
              />
              <SelectFilter
                label="Outlet"
                value={outlet}
                onChange={setOutlet}
                options={outlets}
                placeholder="All Outlets"
              />
              <SelectFilter
                label="Supervisor"
                value={supervisor}
                onChange={setSupervisor}
                options={supervisors}
                placeholder="All Supervisors"
              />
              <SelectFilter
                label="Market Reader"
                value={marketReader}
                onChange={setMarketReader}
                options={readers}
                placeholder="All Readers"
              />
            </div>
          </section>

          {/* Bulk actions */}
          {filteredItems.length > 0 && (
            <section className="mt-6 flex justify-center">
              <div className="flex w-full max-w-8xl items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm text-prism-text">
                <span className="font-semibold">
                  {filteredItems.length} item(s) found ({selectedIds.length} selected)
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBulkAllMode("approve")}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Approve All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAllMode("reject")}
                    className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                  >
                    Reject All
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Table */}
          <section className="mt-8">
            <div className="overflow-x-auto max-w-full rounded-3xl bg-white shadow-sm">
              <table className="min-w-[1100px] w-full table-auto text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.18em] text-prism-muted">
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
                    <tr
                      key={item.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-prism-bg">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {item.name}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {item.code}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {item.region}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {item.market}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {item.outlet}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {item.marketReader}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {item.supervisor}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {item.prevPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {item.currentPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-5">
                        <ChangeRing percent={item.percentChange} />
                      </td>
                      <td className="px-6 py-5 text-center">
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
                      <td className="px-6 py-5 text-center">
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
            isOpen={bulkAllMode !== null}
            mode={bulkAllMode}
            count={filteredItems.length}
            ids={filteredItems.map((i) => i.id)}
            title={
              bulkAllMode === "approve"
                ? "Approve All Threshold Exceptions"
                : "Reject All Threshold Exceptions"
            }
            confirmLabel={bulkAllMode === "approve" ? "Approve All" : "Reject All"}
            onConfirm={(comment) => {
              if (!bulkAllMode) return;
              handleBulkAllConfirm(comment, bulkAllMode);
            }}
            onClose={() => setBulkAllMode(null)}
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
