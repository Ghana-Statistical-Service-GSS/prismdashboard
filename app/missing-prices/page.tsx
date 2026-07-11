"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type Item = {
  id: number;
  name: string;
  code: string;
  brand: string;
  updatedAt: string;
  image: string;
  region: string;
  district: string;
  market: string;
  outlet: string;
  marketReader: string;
  supervisor: string;
  prevPrice?: number | null;
  currentPrice?: number | null;
};

const items: Item[] = [
  {
    id: 1,
    name: "TOMATO",
    code: "3737398",
    brand: "VEGETABLE",
    updatedAt: "TODAY",
    image: "/items/tomato.jpg",
    region: "UPPER WEST",
    district: "WA MUNICIPAL",
    market: "MAIN MARKET",
    outlet: "OUTLET 1",
    marketReader: "John Doe",
    supervisor: "Jane Smith",
    prevPrice: 5.0,
    currentPrice: null,
  },
  {
    id: 2,
    name: "MAIZE",
    code: "3737398",
    brand: "CEREAL",
    updatedAt: "TODAY",
    image: "/items/maize.jpg",
    region: "NORTHERN",
    district: "TAMALE",
    market: "WEST MARKET",
    outlet: "OUTLET 2",
    marketReader: "Abena Mensah",
    supervisor: "Kofi Mensah",
    prevPrice: 12.0,
    currentPrice: undefined,
  },
  {
    id: 3,
    name: "PEPPER",
    code: "3737398",
    brand: "SPICE",
    updatedAt: "TODAY",
    image: "/items/pepper.jpg",
    region: "GREATER ACCRA",
    district: "ACCRA",
    market: "NEW MARKET",
    outlet: "OUTLET 3",
    marketReader: "Yaw Boateng",
    supervisor: "Ama Adjei",
    prevPrice: 10.0,
    currentPrice: Number.NaN,
  },
  {
    id: 4,
    name: "PARACETAMOL",
    code: "3737398",
    brand: "ANTIBIOTIC",
    updatedAt: "TODAY",
    image: "/items/paracetamol.jpg",
    region: "ASHANTI",
    district: "KUMASI",
    market: "OLD MARKET",
    outlet: "OUTLET 4",
    marketReader: "Kojo Agyeman",
    supervisor: "Efua Owusu",
    prevPrice: 3.0,
    currentPrice: null,
  },
];

const missingPriceItems = items.filter(
  (item) => item.currentPrice == null || Number.isNaN(item.currentPrice)
);

export default function MissingPricesPage() {
  const [draftPrices, setDraftPrices] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemCount = useMemo(() => missingPriceItems.length, []);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Imput Excel selected:", file);
    }
  };

  const handleImput = (id: number) => {
    const value = draftPrices[id];
    if (!value) return;
    console.log("Imputed price", { id, price: value });
    setDraftPrices((prev) => ({ ...prev, [id]: "" }));
  };

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-10 py-8">
          {/* Header */}
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-prism-text">
                MISSING PRICES
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can manage all missing items here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/missing-avatar.png"
                alt="Missing prices"
                width={200}
                height={160}
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Count */}
          <section className="mt-10 flex justify-center">
            <div className="flex w-full max-w-8xl items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {itemCount} ITEMS
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={handleFileClick}
                  className="rounded-full bg-[#221B51] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  ⭳ Upload Imput
                </button>
              </div>
            </div>
          </section>

          {/* Table */}
          <section className="mt-8 flex justify-center">
            <div className="w-full max-w-8xl overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-6 py-4">Picture</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Region</th>
                    <th className="px-6 py-4">Market</th>
                    <th className="px-6 py-4">Outlet</th>
                    <th className="px-6 py-4 text-right">Imput</th>
                  </tr>
                </thead>
                <tbody>
                  {missingPriceItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
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
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={draftPrices[item.id] ?? ""}
                            onChange={(e) =>
                              setDraftPrices((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="w-28 rounded-full border border-slate-200 px-3 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                            placeholder="0.00"
                          />
                          <button
                            type="button"
                            onClick={() => handleImput(item.id)}
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            Imput
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
