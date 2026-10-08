"use client";

import { useSyncExternalStore } from "react";

// Which collection the dashboard shows: Market Reading (the monthly rebasing
// collection, the default) or Market Initiation (the one-time exercise). The
// choice filters the sidebar and decides where "Dashboard" goes. It is kept in
// a cookie (so the server-side redirect after sign-in can honour it) and
// mirrored in memory for the components that read it.
export type DashboardModule = "reading" | "initiation";

export const MODULE_COOKIE = "prism_module";
export const MODULE_HOME: Record<DashboardModule, string> = {
  reading: "/dashboard/market-reading",
  initiation: "/dashboard",
};
export const MODULE_LABEL: Record<DashboardModule, string> = {
  reading: "Market Reading",
  initiation: "Market Initiation",
};

// Pages that belong to one collection only; visiting one switches the module.
const READING_PATHS = ["/dashboard/market-reading", "/market-reading", "/collection-calendar"];
const INITIATION_PATHS = ["/reports", "/validations", "/validation", "/sms", "/email-alerts", "/photos", "/field-officers",
  "/threshold-exception", "/missing-prices", "/assignments"];

const startsWith = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export function moduleForPath(pathname: string): DashboardModule | null {
  if (READING_PATHS.some((base) => startsWith(pathname, base))) return "reading";
  if (pathname === "/dashboard" || INITIATION_PATHS.some((base) => startsWith(pathname, base))) return "initiation";
  return null;
}

function readCookie(): DashboardModule {
  if (typeof document === "undefined") return "reading";
  const match = document.cookie.match(new RegExp(`(?:^|; )${MODULE_COOKIE}=([^;]*)`));
  return match?.[1] === "initiation" ? "initiation" : "reading";
}

let current: DashboardModule | null = null;
const listeners = new Set<() => void>();

export function setDashboardModule(next: DashboardModule) {
  if (typeof document !== "undefined") {
    document.cookie = `${MODULE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  if (current === next) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => (current ??= readCookie());

export function useDashboardModule() {
  return useSyncExternalStore(subscribe, snapshot, () => "reading" as DashboardModule);
}
