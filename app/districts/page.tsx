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

const districts = [
  { id: "0055", name: "WA MUNICIPAL", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "03993", name: "NANDOM", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "388573", name: "WA WEST", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
];

export default function DistrictsPage() {
  const [districtId, setDistrictId] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [region, setRegion] = useState("Greater Accra");

  const regionOptionsMemo = useMemo(() => regionOptions, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // placeholder submit handler for future wiring
    setDistrictId("");
    setDistrictName("");
    setRegion("Greater Accra");
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
                DISTRICTS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the districts here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/region-avatar.png"
                alt="District settings"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Add district pill */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl rounded-[2.5rem] bg-white p-6 shadow-lg">
              <form
                className="flex flex-col gap-4 md:flex-row md:items-end"
                onSubmit={handleSubmit}
              >
                <div className="flex-1">
                  <label
                    htmlFor="districtId"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    District ID
                  </label>
                  <input
                    id="districtId"
                    name="districtId"
                    type="text"
                    placeholder="District Id"
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="districtName"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Name
                  </label>
                  <input
                    id="districtName"
                    name="districtName"
                    type="text"
                    placeholder="District Name"
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1">
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

                <div className="md:w-40">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#221B51] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Add District
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Districts table */}
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
                  {districts.map((district) => (
                    <tr
                      key={district.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {district.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {district.name}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {district.createdBy}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {district.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${district.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${district.name}`}
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
