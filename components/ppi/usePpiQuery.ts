"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ppiApi } from "./api";

// PPI reads keep the last response per key. A mutation invalidates by key
// prefix ("ppi:queue", "ppi:submission:<id>"); only PPI queries under that
// prefix refetch. Same pattern as the Market Reading module's query hook,
// kept separate so the two modules never share cache entries.
const versions = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot = 0;

export function invalidatePpi(prefix: string) {
  for (const key of [...versions.keys()]) if (key.startsWith(prefix)) versions.set(key, (versions.get(key) ?? 0) + 1);
  snapshot += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

type Result<T> = { key: string; data: T | null; error: string; code?: string };

export function usePpiQuery<T>(key: string | null, path: string | null) {
  useSyncExternalStore(subscribe, () => snapshot, () => 0);
  if (key && !versions.has(key)) versions.set(key, 0);
  const version = key ? versions.get(key) ?? 0 : 0;
  const requestKey = key && path ? `${key}#${version}` : "";
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (!requestKey || !path) return;
    const controller = new AbortController();
    ppiApi<T>(path, { signal: controller.signal })
      .then((data) => setResult({ key: requestKey, data, error: "" }))
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        setResult((current) => ({ key: requestKey, data: current.data, error: reason instanceof Error ? reason.message : "Request failed", code: reason.code }));
      });
    return () => controller.abort();
  }, [requestKey, path]);

  const current = result.key === requestKey;
  return { data: result.data, error: current ? result.error : "", code: current ? result.code : undefined, loading: !!requestKey && !current };
}
