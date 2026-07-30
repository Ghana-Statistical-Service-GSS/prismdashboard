"use client";

import type { DashboardUser } from "@/lib/auth";

let cachedUser: DashboardUser | null = null;
let pendingRequest: Promise<DashboardUser> | null = null;

export function loadDashboardUser() {
  if (cachedUser) return Promise.resolve(cachedUser);
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetch("/api/auth/me", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Session unavailable");
      const body = await response.json();
      if (!body?.user) throw new Error("Session unavailable");
      cachedUser = body.user as DashboardUser;
      return cachedUser;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function clearDashboardUser() {
  cachedUser = null;
  pendingRequest = null;
}
