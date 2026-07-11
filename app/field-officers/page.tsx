"use client";

import Image from "next/image";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ProgressCircle } from "@/components/common/ProgressCircle";

type Officer = {
  id: number;
  name: string;
  assigned: number;
  completed: number;
  ongoing: number;
  region: string;
  progress: number;
};

const fieldOfficers: Officer[] = [
  {
    id: 1,
    name: "AHMED SALIM",
    assigned: 500,
    completed: 450,
    ongoing: 50,
    region: "ASHANTI",
    progress: 85,
  },
  {
    id: 2,
    name: "AFISU GANIYU",
    assigned: 500,
    completed: 100,
    ongoing: 400,
    region: "ASHANTI",
    progress: 20,
  },
  {
    id: 3,
    name: "IKWAMENA",
    assigned: 500,
    completed: 400,
    ongoing: 100,
    region: "ASHANTI",
    progress: 77,
  },
  {
    id: 4,
    name: "PAA KWESI",
    assigned: 500,
    completed: 300,
    ongoing: 200,
    region: "ASHANTI",
    progress: 40,
  },
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function FieldOfficersPage() {
  const [month, setMonth] = useState<string>("");

  const handleMonthChange = (value: string) => {
    setMonth(value);
    console.log("Selected month:", value);
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
                FIELD OFFICERS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can monitor field officers’ data collection performance here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/officer-avatar.png"
                alt="Field officers"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Count + Month filter */}
          <section className="mt-8">
            <div className="flex flex-col gap-3 rounded-2xl bg-white px-6 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {fieldOfficers.length} FIELD OFFICERS
              </p>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-prism-muted">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="rounded-full border border-prism-border bg-white px-4 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
                >
                  <option value="">Select Month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>



          {/* Table */}
          <section className="mt-8 flex justify-center">
            <div className="w-full max-w-8xl overflow-x-auto rounded-3xl bg-white shadow-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-6 py-4">Field Officer</th>
                    <th className="px-6 py-4 text-center">Assigned Items</th>
                    <th className="px-6 py-4 text-center">Completed</th>
                    <th className="px-6 py-4 text-center">Ongoing</th>
                    <th className="px-6 py-4 text-center">Region</th>
                    <th className="px-6 py-4 text-center">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldOfficers.map((officer) => (
                    <tr
                      key={officer.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {officer.name}
                      </td>
                      <td className="px-6 py-5 text-center text-sm font-semibold text-prism-text">
                        {officer.assigned}
                      </td>
                      <td className="px-6 py-5 text-center text-sm font-semibold text-prism-text">
                        {officer.completed}
                      </td>
                      <td className="px-6 py-5 text-center text-sm font-semibold text-prism-text">
                        {officer.ongoing}
                      </td>
                      <td className="px-6 py-5 text-center text-sm font-semibold uppercase text-prism-text">
                        {officer.region}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center">
                          <ProgressCircle percent={officer.progress} />
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
