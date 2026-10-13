"use client";

import { useMemo, useState } from "react";

// Search and paging for a list that is already in the browser (one row per
// market, reader or region). Every word typed must appear in the row's text.
export function useTableControls<T>(rows: T[], textOf: (row: T) => string, initialPageSize: 10 | 20 = 20) {
  const [query, setQueryState] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<10 | 20>(initialPageSize);

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((row) => {
      const text = textOf(row).toLowerCase();
      return words.every((word) => text.includes(word));
    });
    // textOf is usually an inline function; the rows and query decide the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    query,
    setQuery: (value: string) => { setQueryState(value); setPage(1); },
    page: current,
    setPage,
    pageSize,
    setPageSize: (value: 10 | 20) => { setPageSizeState(value); setPage(1); },
    total: filtered.length,
    filtered,
    pageRows: filtered.slice((current - 1) * pageSize, current * pageSize),
  };
}
