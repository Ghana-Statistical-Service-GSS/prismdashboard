"use client";

// components/layout/Topbar.tsx
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuthActions } from "@/hooks/useAuthActions";
import type { DashboardUser } from "@/lib/auth";

export function Topbar() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { signOut } = useAuthActions();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session unavailable");
        return response.json();
      })
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) signOut();
      });
    return () => { active = false; };
  }, [signOut]);

  return (
    <header className="relative flex items-center justify-between border-b border-prism-border bg-[#F5F5F7] px-8 py-4">
      {/* Left logo */}
      <div className="flex items-center">
        <Image
          src="/gss-logo.png"
          alt="Ghana Statistical Service"
          width={50}
          height={50}
          className="select-none"
        />
      </div>

      {/* Center greeting - truly centered in the header */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm">
          <div className="relative h-9 w-9">
            <Image
              src="/user-avatar.png"
              alt="User avatar"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <div className="text-sm leading-tight">
            <p className="font-semibold text-prism-text">
              Hi, {user?.full_name || "PRISM User"} 👋
            </p>
            <p className="text-[11px] text-prism-muted">
              {user ? user.role.replaceAll("_", " ") : "Loading your profile..."}
            </p>
          </div>
        </div>
      </div>

      {/* Right avatar + menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="relative h-9 w-9 rounded-full border-2 border-white shadow-md"
        >
          <Image
            src="/user-avatar.png"
            alt="User avatar"
            fill
            className="rounded-full object-cover"
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white py-2 shadow-lg ring-1 ring-slate-100">
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
