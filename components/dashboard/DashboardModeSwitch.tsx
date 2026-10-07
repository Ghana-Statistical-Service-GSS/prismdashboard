"use client";

import Link from "next/link";
import clsx from "clsx";

export type DashboardMode = "initiation" | "reading";

const MODES: { mode: DashboardMode; label: string; href: string }[] = [
  { mode: "initiation", label: "Market Initiation", href: "/dashboard" },
  { mode: "reading", label: "Market Reading", href: "/dashboard/market-reading" },
];

// Switches between the one-time initiation exercise and the monthly
// rebasing collection (Market Reading). Each mode is its own route so the
// view survives refreshes and can be linked.
export function DashboardModeSwitch({ active }: { active: DashboardMode }) {
  return (
    <nav aria-label="Dashboard mode" className="grid w-full grid-cols-2 rounded-full border border-prism-border bg-white p-1.5 shadow-sm sm:inline-grid sm:w-fit">
      {MODES.map((item) => (
        <Link
          key={item.mode}
          href={item.href}
          aria-current={item.mode === active ? "page" : undefined}
          className={clsx(
            "rounded-full px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] transition sm:px-5 sm:text-xs",
            item.mode === active ? "bg-prism-purple text-white" : "text-prism-muted hover:text-prism-text"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
