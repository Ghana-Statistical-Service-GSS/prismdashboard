"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AddStaffModal } from "@/components/staff/AddStaffModal";

const staff = [
  { id: "0055", name: "AHMED SALIM", createdBy: "WAHAB", updatedAt: "TODAY" },
  { id: "0055-2", name: "YAKUB KARIM", createdBy: "WAHAB", updatedAt: "TODAY" },
  { id: "0055-3", name: "IBRAHIM", createdBy: "WAHAB", updatedAt: "TODAY" },
  { id: "0055-4", name: "AHMED SALIM", createdBy: "WAHAB", updatedAt: "TODAY" },
];

export default function StaffPage() {
  const staffCount = useMemo(() => staff.length, []);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

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
                USERS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the Users here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/users-avatar.png"
                alt="Users management"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Count + Add user bar */}
          <section className="mt-10 flex justify-center">
            <div className="flex w-full max-w-8xl items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {staffCount} USERS
              </p>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(true)}
                className="rounded-full bg-[#221B51] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                + Add User
              </button>
            </div>
          </section>

          {/* Staff table */}
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
                  {staff.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-prism-text">
                        {user.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold uppercase text-prism-text">
                        {user.name}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {user.createdBy}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {user.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${user.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${user.name}`}
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

      <AddStaffModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
      />
    </div>
  );
}
