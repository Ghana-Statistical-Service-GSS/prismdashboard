"use client";

import { useSyncExternalStore } from "react";

// Open/closed state of the mobile navigation drawer, shared by the Topbar
// (menu button) and the Sidebar (drawer) without a provider on every page.
let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setSidebarOpen(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSidebarOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
