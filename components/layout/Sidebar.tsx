// components/layout/Sidebar.tsx
"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuthActions } from "@/hooks/useAuthActions";

type NavItem = {
  label: string;
  href?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "DATA",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Reports", href: "/reports" },
      { label: "Validations", href: "/validations" },
      { label: "SMS Alerts", href: "/sms" },
      { label: "Assignments", href: "/assignments" },
      { label: "Field Officers", href: "/field-officers" },
    ],
  },
  {
    title: "CONFIGURATION",
    items: [
      { label: "Regions", href: "/regions" },
      { label: "Districts", href: "/districts" },
      { label: "Markets", href: "/markets" },
      { label: "Outlets", href: "/outlets" },
      { label: "Items", href: "/items" },
      { label: "Staff", href: "/staff" },
    ],
  },
  {
    title: "VALIDATE",
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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-prism-border bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-prism-border/60">
        <div className="relative h-10 w-10">
          <Image
            src="/gss-logo.png"
            fill
            alt="GSS logo"
            className="object-contain"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-prism-muted">
            PRICE INDEX
          </span>
          <span className="text-lg font-extrabold tracking-tight text-prism-purple">
            PRISM
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-sm">
        {navSections.map((section) => (
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
