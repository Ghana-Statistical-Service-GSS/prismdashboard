"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string; hint?: string };

export function SearchableSelect({ value, onChange, options, placeholder, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle) || option.hint?.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <input
        value={open ? query : selected?.label ?? ""}
        placeholder={selected ? selected.label : placeholder}
        disabled={disabled}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(""); } }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); setQuery(""); }
          if (event.key === "Enter") { event.preventDefault(); if (filtered.length === 1) choose(filtered[0].value); }
        }}
        className="w-full rounded-xl border border-prism-border bg-white px-3 py-2 pr-8 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-prism-muted"
      />
      {value && !open && !disabled && (
        <button type="button" onClick={() => choose("")} aria-label="Clear filter" className="absolute inset-y-0 right-2 text-sm text-prism-muted hover:text-prism-text">×</button>
      )}
      {open && (
        <ul className="absolute z-40 mt-1 max-h-56 w-full min-w-48 overflow-auto rounded-xl border border-prism-border bg-white py-1 shadow-lg">
          <li>
            <button type="button" onClick={() => choose("")} className="w-full px-3 py-2 text-left text-xs font-semibold text-prism-muted hover:bg-prism-bg">{placeholder}</button>
          </li>
          {filtered.map((option) => (
            <li key={option.value}>
              <button type="button" onClick={() => choose(option.value)} className={`w-full px-3 py-2 text-left text-xs hover:bg-prism-bg ${option.value === value ? "font-bold text-prism-purple" : "text-prism-text"}`}>
                {option.label}
                {option.hint && <span className="ml-1 text-[10px] text-prism-muted">{option.hint}</span>}
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-3 py-2 text-xs text-prism-muted">No matches</li>}
        </ul>
      )}
    </div>
  );
}
