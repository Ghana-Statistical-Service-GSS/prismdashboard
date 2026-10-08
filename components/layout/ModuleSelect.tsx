"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { DashboardModule, MODULE_HOME, MODULE_LABEL, setDashboardModule, useDashboardModule } from "@/lib/module-store";

const OPTIONS: { module: DashboardModule; hint: string; dot: string }[] = [
  { module: "reading", hint: "Monthly price collection", dot: "bg-prism-teal" },
  { module: "initiation", hint: "One-time outlet and product setup", dot: "bg-prism-purple" },
];

// Top-bar dropdown: choose which collection the whole dashboard shows.
export function ModuleSelect() {
  const router = useRouter();
  const current = useDashboardModule();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (next: DashboardModule) => {
    setOpen(false);
    setDashboardModule(next);
    router.push(MODULE_HOME[next]);
  };
  const active = OPTIONS.find((o) => o.module === current) ?? OPTIONS[0];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-left shadow-sm ring-1 ring-prism-border/70 hover:ring-prism-purple/40 sm:px-4"
      >
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", active.dot)} aria-hidden="true" />
        <span className="leading-tight">
          <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-prism-muted sm:block">Module</span>
          <span className="block text-xs font-black text-prism-text sm:text-sm">{MODULE_LABEL[current]}</span>
        </span>
        <svg viewBox="0 0 20 20" className={clsx("h-4 w-4 text-prism-muted transition", open && "rotate-180")} fill="currentColor" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <ul role="listbox" aria-label="Module" className="absolute left-0 z-50 mt-2 w-72 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-100">
          {OPTIONS.map((option) => (
            <li key={option.module}>
              <button
                type="button"
                role="option"
                aria-selected={option.module === current}
                onClick={() => choose(option.module)}
                className={clsx("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left", option.module === current ? "bg-prism-bg" : "hover:bg-prism-bg/60")}
              >
                <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", option.dot)} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-sm font-black text-prism-text">{MODULE_LABEL[option.module]}</span>
                  <span className="block text-[11px] text-prism-muted">{option.hint}</span>
                </span>
                {option.module === current && <span className="text-xs font-black text-prism-purple">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
