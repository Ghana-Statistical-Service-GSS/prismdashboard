// components/layout/Sidebar.tsx
"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useAuthActions } from "@/hooks/useAuthActions";
import type { DashboardUser } from "@/lib/auth";

type NavItem = {
  label: string;
  href?: string;
  hiddenForScopedRole?: boolean;
  hiddenForSupervisor?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
  hiddenForScopedRole?: boolean;
};

const navSections: NavSection[] = [
  {
    title: "DATA",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Reports", href: "/reports" },
      { label: "Validations", href: "/validations" },
      { label: "SMS Alerts", href: "/sms", hiddenForScopedRole: true },
      { label: "Photo Album", href: "/photos" },
      { label: "Field Officers", href: "/field-officers" },
    ],
  },
  {
    title: "CONFIGURATION",
    items: [
      { label: "Assignments", href: "/assignments", hiddenForSupervisor: true },
      { label: "Regions", href: "/regions", hiddenForScopedRole: true },
      { label: "Districts", href: "/districts", hiddenForScopedRole: true },
      { label: "Markets", href: "/markets", hiddenForScopedRole: true },
      { label: "Outlets", href: "/outlets", hiddenForScopedRole: true },
      { label: "Items", href: "/items", hiddenForScopedRole: true },
      { label: "Staff", href: "/staff", hiddenForScopedRole: true },
    ],
  },
  {
    title: "VALIDATE",
    hiddenForScopedRole: true,
    items: [
      { label: "Validation", href: "/validation" },
      { label: "Threshold Exception (Price)", href: "/threshold-exception" },
      { label: "Missing Prices", href: "/missing-prices" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const [role, setRole] = useState<DashboardUser["role"] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (active && body?.user?.role) setRole(body.user.role); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const isScopedRole = role === "REGIONAL_STATISTICIAN" || role === "SUPERVISOR";
  const isSupervisor = role === "SUPERVISOR";
  const visibleSections = navSections
    .filter((section) => !(section.hiddenForScopedRole && (isScopedRole || role === null)))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !((item.hiddenForScopedRole && (isScopedRole || role === null)) || (item.hiddenForSupervisor && (isSupervisor || role === null)))),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-prism-border bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-prism-border/60 px-4 py-3">
        <div className="relative h-20 w-20 shrink-0">
          <Image
            src="/Prism-logo.png"
            fill
            alt="PRISM-Ghana logo"
            sizes="80px"
            className="object-contain"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-prism-muted">
            PRICE INDEX
          </span>
          <span className="text-lg font-extrabold tracking-tight text-prism-purple">
            PRISM-GHANA
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-prism-muted">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active =
                  item.href && pathname.startsWith(item.href ?? "");
                return (
                  <li key={item.label}>
                      <a
                        href={item.href ?? "#"}
                        className={clsx(
                          "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
                          active
                            ? "bg-prism-bg text-prism-text ring-1 ring-prism-purple/40"
                            : "text-prism-text hover:bg-prism-bg"
                        )}
                      >
                        <span
                          className={clsx(
                            "h-1 w-1 rounded-full",
                            active ? "bg-prism-purple" : "bg-prism-border"
                          )}
                        />
                        {item.label}
                      </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-6 pb-6 pt-2">
        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-full bg-prism-pink px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm hover:brightness-105 transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
