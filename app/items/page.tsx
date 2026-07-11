"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AddItemModal } from "@/components/items/AddItemModal";

const items = [
  {
    id: 1,
    name: "TOMATO",
    code: "3737398",
    brand: "VEGETABLE",
    updatedAt: "TODAY",
    image: "/items/tomato.jpg",
  },
  {
    id: 2,
    name: "MAIZE",
    code: "3737398",
    brand: "CEREAL",
    updatedAt: "TODAY",
    image: "/items/maize.jpg",
  },
  {
    id: 3,
    name: "PEPPER",
    code: "3737398",
    brand: "SPICE",
    updatedAt: "TODAY",
    image: "/items/pepper.jpg",
  },
  {
    id: 4,
    name: "PARACETAMOL",
    code: "3737398",
    brand: "ANTIBIOTIC",
    updatedAt: "TODAY",
    image: "/items/paracetamol.jpg",
  },
];

export default function ItemsPage() {
  const itemCount = useMemo(() => items.length, []);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

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
                ITEMS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                You can add and manage all the Items here
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/item-avatar.png"
                alt="Item settings"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          {/* Count + Add bar */}
          <section className="mt-10 flex justify-center">
            <div className="flex w-full max-w-8xl items-center justify-between rounded-2xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
                {itemCount} ITEMS
              </p>
              <button
                type="button"
                onClick={() => setIsAddItemOpen(true)}
                className="rounded-full bg-[#221B51] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                + Add Item
              </button>
            </div>
          </section>

          {/* Items table */}
          <section className="mt-10 flex justify-center">
            <div className="w-full max-w-8xl overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
                  <tr>
                    <th className="px-6 py-4">Picture</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Updated At</th>
                    <th className="px-6 py-4 text-center">Edit</th>
                    <th className="px-6 py-4 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-prism-border/50 last:border-b-0"
                    >
                      <td className="px-6 py-5">
                        <div className="relative h-10 w-16 overflow-hidden rounded-lg bg-prism-bg">
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
                        {item.brand}
                      </td>
                      <td className="px-6 py-5 text-xs font-semibold uppercase text-prism-text">
                        {item.updatedAt}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white hover:brightness-105"
                          aria-label={`Edit ${item.name}`}
                        >
                          ✏️
                        </button>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:brightness-105"
                          aria-label={`Delete ${item.name}`}
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

      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
      />
    </div>
  );
}
