"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const regions = [
  { id: "0055", name: "UPPER WEST", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "03993", name: "UPPER EAST", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
  { id: "388573", name: "WESTERN", createdBy: "AHMED SALIM", updatedAt: "TODAY" },
];

export default function RegionsPage() {
  const [regionId, setRegionId] = useState("");
  const [regionName, setRegionName] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // placeholder submit handler for future wiring
    setRegionId("");
    setRegionName("");
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
                REGIONS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the regions here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/region-avatar.png"
                alt="Region settings"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Add region pill */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl rounded-[2.5rem] bg-white p-6 shadow-lg">
              <form
                className="flex flex-col gap-4 md:flex-row md:items-end"
                onSubmit={handleSubmit}
              >
                <div className="flex-1">
                  <label
                    htmlFor="regionId"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Region ID
                  </label>
                  <input
                    id="regionId"
                    name="regionId"
                    type="text"
                    placeholder="Region Id"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="regionName"
                    className="mb-2 block text-sm font-semibold text-prism-text"
                  >
                    Name
                  </label>
                  <input
                    id="regionName"
                    name="regionName"
                    type="text"
                    placeholder="Region Name"
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    className="w-full rounded-full border border-prism-border bg-white px-4 py-3 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                  />
                </div>

                <div className="md:w-40">
                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#221B51] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                  >
                    Add Region
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Regions table */}
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
                  {regions.map((region) => (
                    <tr
                      key={region.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {region.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {region.name}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {region.createdBy}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {region.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${region.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${region.name}`}
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
