"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const regionOptions = [
  "Western",
  "Central",
  "Greater Accra",
  "Volta",
  "Eastern",
  "Ashanti",
  "Western North",
  "Ahafo",
  "Bono",
  "Bono East",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
];

const districtOptions = ["Nandom District", "Wa Municipal", "Wa West"];

const markets = [
  { id: "0055", name: "WA MARKET", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "03993", name: "NANDOM MARKET", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "388573", name: "T MARKET", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
];

export default function MarketsPage() {
  const [marketId, setMarketId] = useState("");
  const [marketName, setMarketName] = useState("");
  const [region, setRegion] = useState("Greater Accra");
  const [district, setDistrict] = useState("Nandom District");

  const regionOptionsMemo = useMemo(() => regionOptions, []);
  const districtOptionsMemo = useMemo(() => districtOptions, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // placeholder submit handler for future wiring
    setMarketId("");
    setMarketName("");
    setRegion("Upper West");
    setDistrict("Nandom District");
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
                MARKETS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the Markets here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/market-avatar.png"
                alt="Market settings"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Add market pill */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl rounded-[2.5rem] bg-white p-6 shadow-lg">
              <form
                className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap"
                onSubmit={handleSubmit}
              >
                <div className="flex-1 min-w-[220px]">
                  <label
                    htmlFor="marketId"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Market Id
                  </label>
                  <input
                    id="marketId"
                    name="marketId"
                    type="text"
                    placeholder="Market Id"
                    value={marketId}
                    onChange={(e) => setMarketId(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1 min-w-[220px]">
                  <label
                    htmlFor="marketName"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Name
                  </label>
                  <input
                    id="marketName"
                    name="marketName"
                    type="text"
                    placeholder="Market Name"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="region"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Region
                  </label>
                  <select
                    id="region"
                    name="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  >
                    {regionOptionsMemo.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="district"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    District
                  </label>
                  <select
                    id="district"
                    name="district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  >
                    {districtOptionsMemo.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:w-40 w-full">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#221B51] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Add Market
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Markets table */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Created By</th>
                    <th className="px-6 py-4">Updated At</th>
                    <th className="px-6 py-4 text-center">Edit</th>
                    <th className="px-6 py-4 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market) => (
                    <tr
                      key={market.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {market.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {market.name}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {market.createdBy}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {market.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${market.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${market.name}`}
                        >
                          🗑️
                        </button>
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
