"use client";

import Link from "next/link";

type TabKey = "region" | "markets" | "outlets";

type Tab = {
  key: TabKey;
  label: string;
  cards: {
    title: string;
    description: string;
    href: string;
  }[];
};

const tabs: Tab[] = [
  {
    key: "region",
    label: "Region & Roles",
    cards: [
      {
        title: "Assign Regions to RS",
        description: "Assign Regional Statisticians to regions.",
        href: "/assignments/regions",
      },
    ],
  },
  {
    key: "markets",
    label: "Markets & Supervisors",
    cards: [
      {
        title: "Assign Markets to Supervisors",
        description: "Map markets in a region to supervisors.",
        href: "/assignments/markets",
      },
    ],
  },
  {
    key: "outlets",
    label: "Outlets & Market Readers",
    cards: [
      {
        title: "Assign Outlets & Items to Market Readers",
        description: "Assign outlet(s) and item(s) to market readers.",
        href: "/assignments/outlets",
      },
    ],
  },
];

type AssignmentsTabsProps = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

export function AssignmentsTabs({ active, onChange }: AssignmentsTabsProps) {
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[#221B51] text-white shadow-sm"
                  : "bg-slate-100 text-prism-text hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeTab.cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-prism-text">{card.title}</h3>
                <p className="mt-2 text-sm text-prism-muted">{card.description}</p>
              </div>
              <div className="mt-4 text-sm font-semibold text-[#221B51]">
                Manage →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
