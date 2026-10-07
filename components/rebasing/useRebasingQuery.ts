"use client";

import { useEffect, useState } from "react";
import { rebasingApi } from "./api";

type Result<T> = { key: string; data: T | null; error: string };

// GET a rebasing endpoint and keep the last response. `loading` is derived
// from whether the stored response belongs to the current path/version, so
// the effect only sets state from the request callbacks. Pass null to skip.
export function useRebasingQuery<T>(path: string | null, version = 0) {
  const key = path === null ? "" : `${path}#${version}`;
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: "" });

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    rebasingApi<T>(path, { signal: controller.signal })
      .then((data) => setResult({ key, data, error: "" }))
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        setResult((current) => ({ key, data: current.data, error: reason instanceof Error ? reason.message : "Request failed" }));
      });
    return () => controller.abort();
  }, [path, key]);

  const current = result.key === key;
  return {
    // Previous data stays visible while a new request is in flight.
    data: result.data,
    error: current ? result.error : "",
    loading: path !== null && !current,
  };
}
