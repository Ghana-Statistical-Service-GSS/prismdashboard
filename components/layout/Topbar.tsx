"use client";

// components/layout/Topbar.tsx
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuthActions } from "@/hooks/useAuthActions";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { setSidebarOpen } from "@/lib/sidebar-store";
import { ModuleSelect } from "./ModuleSelect";

// Which backend this dashboard is using. Shown for anything but production so
// test and real data are never confused (set by .env.local / npm run dev:*).
const ENVIRONMENT = (process.env.NEXT_PUBLIC_PRISM_ENV || "PRODUCTION").toUpperCase();

export function Topbar() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { signOut } = useAuthActions();

  useEffect(() => {
    let active = true;
    loadDashboardUser()
      .then((dashboardUser) => {
        if (active) setUser(dashboardUser);
      })
      .catch(() => {
        if (active) signOut();
      });
    return () => { active = false; };
  }, [signOut]);

  return (
    <header className="relative flex items-center justify-between gap-3 border-b border-prism-border bg-[#F5F5F7] px-4 py-3 sm:px-8 sm:py-4">
      {/* Left: menu (below lg) + logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-prism-purple shadow-sm lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Image
          src="/gss-logo-ui.png"
          alt="Ghana Statistical Service"
          width={50}
          height={50}
          className="hidden h-10 w-10 select-none object-contain sm:block sm:h-[50px] sm:w-[50px]"
        />
        <ModuleSelect />
        {ENVIRONMENT !== "PRODUCTION" && (
          <span
            title="This dashboard is connected to a non-production backend"
            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ENVIRONMENT === "LOCAL" ? "bg-indigo-100 text-indigo-800" : "bg-amber-100 text-amber-900 ring-1 ring-amber-300"}`}
          >
            {ENVIRONMENT}
          </span>
        )}
      </div>

      {/* Center greeting - truly centered in the header */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-full bg-white px-3 py-2 shadow-sm sm:px-5 sm:py-3">
          <div className="relative hidden h-9 w-9 shrink-0 sm:block">
            <Image
              src="/user-avatar-ui.png"
              alt="User avatar"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 text-sm leading-tight">
            <p className="truncate font-semibold text-prism-text">
              Hi, {user?.full_name || "PRISM User"} 👋
            </p>
            <p className="truncate text-[11px] text-prism-muted">
              {user ? user.role.replaceAll("_", " ") : "Loading your profile..."}
            </p>
          </div>
        </div>
      </div>

      {/* Right avatar + menu */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="relative h-9 w-9 rounded-full border-2 border-white shadow-md"
        >
          <Image
            src="/user-avatar-ui.png"
            alt="User avatar"
            fill
            className="rounded-full object-cover"
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-40 mt-2 w-48 rounded-2xl bg-white py-2 shadow-lg ring-1 ring-slate-100">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setShowChangePassword(true);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Change password
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
}
