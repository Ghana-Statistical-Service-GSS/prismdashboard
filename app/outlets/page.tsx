"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { OutletSize } from "@/components/assignments/types";

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

const districtOptions = ["Wa Municipal", "Nandom District", "Wa West"];
const marketOptions = ["Wa Market", "Nandom Market", "T Market"];

const outlets = [
  { id: "0055", name: "JOHN SHOP", createdBy: "AHMED SALIM", updatedAt: "TODAY", category: "Medium" },
  { id: "03993", name: "F/A COLLECTION", createdBy: "AHMED SALIM", updatedAt: "TODAY", category: "Small" },
  { id: "388573", name: "FUNTECHS", createdBy: "AHMED SALIM", updatedAt: "TODAY", category: "Large" },
];

export default function OutletsPage() {
  const [outletId, setOutletId] = useState("");
  const [outletName, setOutletName] = useState("");
  const [region, setRegion] = useState("Upper West");
  const [district, setDistrict] = useState("Wa Municipal");
  const [market, setMarket] = useState("Wa Market");
  const [category, setCategory] = useState<OutletSize>("Small");

  const regionOptionsMemo = useMemo(() => regionOptions, []);
  const districtOptionsMemo = useMemo(() => districtOptions, []);
  const marketOptionsMemo = useMemo(() => marketOptions, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // placeholder submit handler for future wiring
    setOutletId("");
    setOutletName("");
    setRegion("Upper West");
    setDistrict("Wa Municipal");
    setMarket("Wa Market");
    setCategory("Small");
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
                OUTLETS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the Outlets here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/outlet-avatar.png"
                alt="Outlet settings"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Add outlet pill */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl rounded-[2.5rem] bg-white p-6 shadow-lg">
              <form
                className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap"
                onSubmit={handleSubmit}
              >
                <div className="flex-1 min-w-[180px]">
                  <label
                    htmlFor="outletId"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Outlet ID
                  </label>
                  <input
                    id="outletId"
                    name="outletId"
                    type="text"
                    placeholder="Outlet Id"
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label
                    htmlFor="outletName"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Name
                  </label>
                  <input
                    id="outletName"
                    name="outletName"
                    type="text"
                    placeholder="Outlet Name"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
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

                <div className="flex-1 min-w-[180px]">
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

                <div className="flex-1 min-w-[180px]">
                  <label
                    htmlFor="market"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Market
                  </label>
              <select
                id="market"
                name="market"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              >
                {marketOptionsMemo.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              
            </div>

                <div className="flex-1 min-w-[120px]">
                  <label
                    htmlFor="category"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Outlet Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as OutletSize)
                    }
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  >
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                  </select>
                </div>

                <div className="md:w-40 w-full">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#221B51] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Add Outlet
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Outlets table */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Created By</th>
                    <th className="px-6 py-4">Updated At</th>
                    <th className="px-6 py-4 text-center">Edit</th>
                    <th className="px-6 py-4 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {outlets.map((outlet) => (
                    <tr
                      key={outlet.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {outlet.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {outlet.name}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {outlet.category}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {outlet.createdBy}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {outlet.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${outlet.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${outlet.name}`}
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
