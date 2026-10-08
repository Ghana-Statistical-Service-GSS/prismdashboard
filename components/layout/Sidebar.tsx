// components/layout/Sidebar.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useAuthActions } from "@/hooks/useAuthActions";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { setSidebarOpen, useSidebarOpen } from "@/lib/sidebar-store";
import { DashboardModule, moduleForPath, setDashboardModule, useDashboardModule } from "@/lib/module-store";

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
  hqOnly?: boolean;
};

// Shared reference data, managed by HQ, available in both modules.
const referenceItems: NavItem[] = [
  { label: "Regions", href: "/regions", hiddenForScopedRole: true },
  { label: "Districts", href: "/districts", hiddenForScopedRole: true },
  { label: "Markets", href: "/markets", hiddenForScopedRole: true },
  { label: "Outlets", href: "/outlets", hiddenForScopedRole: true },
  { label: "Items", href: "/items", hiddenForScopedRole: true },
  { label: "Staff", href: "/staff", hiddenForScopedRole: true },
];

// Each module shows only its own pages (chosen in the top bar).
const navByModule: Record<DashboardModule, NavSection[]> = {
  reading: [
    {
      title: "MARKET READING",
      items: [
        { label: "Dashboard", href: "/dashboard/market-reading" },
        { label: "Workload", href: "/market-reading/workload" },
        { label: "Reports", href: "/market-reading/reports" },
      ],
    },
    {
      title: "CONFIGURATION",
      hqOnly: true,
      items: [{ label: "Collection Calendar", href: "/collection-calendar", hiddenForScopedRole: true }, ...referenceItems],
    },
  ],
  initiation: [
    {
      title: "DATA",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Reports", href: "/reports" },
        { label: "Validations", href: "/validations" },
        { label: "SMS Alerts", href: "/sms", hiddenForScopedRole: true },
        { label: "Email Escalations", href: "/email-alerts", hiddenForScopedRole: true },
        { label: "Photo Album", href: "/photos" },
        { label: "Field Officers", href: "/field-officers" },
      ],
    },
    {
      title: "CONFIGURATION",
      hqOnly: true,
      items: [{ label: "Assignments", href: "/assignments", hiddenForSupervisor: true }, ...referenceItems],
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
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const [role, setRole] = useState<DashboardUser["role"] | null>(null);
  const mobileOpen = useSidebarOpen();
  const dashboardModule = useDashboardModule();

  // A page that belongs to one module selects it (links, bookmarks, refresh).
  useEffect(() => {
    const owner = moduleForPath(pathname);
    if (owner) setDashboardModule(owner);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    loadDashboardUser()
      .then((user) => { if (active) setRole(user.role); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // The mobile drawer closes after navigation and on Escape.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const isScopedRole = role === "REGIONAL_STATISTICIAN" || role === "SUPERVISOR";
  const isSupervisor = role === "SUPERVISOR";
  const isHq = role === "HQ" || role === "ADMIN";
  const visibleSections = navByModule[dashboardModule]
    .filter((section) => !(section.hiddenForScopedRole && (isScopedRole || role === null)) && !(section.hqOnly && !isHq))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !((item.hiddenForScopedRole && (isScopedRole || role === null)) || (item.hiddenForSupervisor && (isSupervisor || role === null)))),
    }))
    .filter((section) => section.items.length > 0);

  const content = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-prism-border/60 px-4 py-3">
        <div className="relative h-20 w-20 shrink-0">
          <Image
            src="/Prism-logo-ui.png"
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
                  !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.label}>
                      <Link
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
                      </Link>
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
    </>
  );

  return (
    <>
      {/* Desktop: fixed column */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-prism-border bg-white lg:flex">
        {content}
      </aside>

      {/* Mobile/tablet: slide-in drawer opened from the Topbar menu button */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted">×</button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
