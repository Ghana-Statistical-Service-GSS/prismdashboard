"use client";

import { type MouseEvent, type ReactNode, useState } from "react";
import clsx from "clsx";
import { pctText, tone } from "./format";

// Building blocks of the PPI dashboard, in the CPI dashboards' visual
// language (cards with an accent bar, pill controls, white panels).

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple focus-visible:ring-offset-2";

// A link to another state of this page (filters, view, list): a real href
// (new tab, copy link) whose plain click moves through the History API
// without scrolling, like the dashboard's own controls.
export function PageLink({ href, className, children, ariaLabel, ariaCurrent }: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  ariaCurrent?: "page";
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
  };
  return <a href={href} onClick={onClick} className={className} aria-label={ariaLabel} aria-current={ariaCurrent}>{children}</a>;
}

const ACCENT = { purple: "bg-prism-purple", teal: "bg-prism-teal", pink: "bg-prism-pink", rose: "bg-rose-500", amber: "bg-amber-400", slate: "bg-slate-300" };

export function MetricCard({ label, value, hint, accent, pct, pctLabel, href, linkLabel, action, children }: {
  label: string;
  value: string;
  hint: ReactNode;
  accent: keyof typeof ACCENT;
  pct?: number | null;
  pctLabel?: string;
  href?: string;
  linkLabel?: string;
  // A control at the foot of the card (e.g. "View breakdown").
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      <span className={`absolute left-0 top-0 h-full w-1.5 ${ACCENT[accent]}`} aria-hidden="true" />
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="text-xs font-bold text-prism-muted sm:text-sm">{label}</h3>
        {pct !== undefined && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${tone(pct)}`} title={pctLabel}>
            <span className="sr-only">{pctLabel}: </span>{pctText(pct)}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:mt-3 sm:text-3xl">{value}</p>
      <div className="mt-1 text-[11px] leading-snug text-prism-muted sm:text-xs">{hint}</div>
      {children}
      {(href || action) && (
        <div className="mt-auto flex flex-col items-start gap-2 pt-3">
          {href ? (
            <PageLink href={href} ariaLabel={`${label}: ${linkLabel || "view list"}`} className={clsx("text-xs font-bold text-prism-purple hover:underline sm:text-sm", focusRing)}>
              <span className="sm:hidden">View list →</span>
              <span className="hidden sm:inline">{linkLabel || "View list"} →</span>
            </PageLink>
          ) : <span />}
          {action}
        </div>
      )}
    </article>
  );
}

// A select with its label inside the box ("Status: Submitted"), as in the
// establishment list and the filters.
export function LabelledSelect({ label, value, onChange, children, className }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("relative flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-prism-border bg-white pl-4 pr-9 text-sm focus-within:ring-2 focus-within:ring-prism-purple/40", className)}>
      <span className="whitespace-nowrap font-bold text-prism-text">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 appearance-none truncate bg-transparent py-2 text-prism-text outline-none">
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 text-prism-muted">⌄</span>
    </label>
  );
}

export function Panel({ id, title, hint, action, children, className }: { id?: string; title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={clsx("min-w-0 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-black text-prism-text">{title}</h2>
          {hint && <div className="mt-1 text-xs text-prism-muted">{hint}</div>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold", className)}>{children}</span>;
}

// Pill buttons for exclusive choices (the CPI drill-level control).
export function Segmented<T extends string>({ label, value, options, onChange, showLabel = false }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  showLabel?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible">
      {showLabel && <span aria-hidden="true" className="mr-1 shrink-0 text-sm font-bold text-prism-text">{label}:</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx("min-h-9 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition", focusRing,
            value === o.value ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted hover:text-prism-text")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Fetches the export first, so a refusal (e.g. an expired session) shows its
// message instead of being saved as a .csv file holding JSON.
export function CsvLink({ href, label = "Download CSV", variant = "pill" }: { href: string; label?: string; variant?: "pill" | "outline" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/"); return; }
      if (!response.ok || !(response.headers.get("content-type") || "").startsWith("text/csv")) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || "The export could not be prepared.");
      }
      const name = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") || "")?.[1] || "ppi-export.csv";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      // Revoked later: some browsers cancel a download whose URL goes in the same tick.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The export could not be prepared.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1 self-start">
      <button type="button" onClick={download} disabled={busy} className={clsx(variant === "outline"
        ? "inline-flex min-h-11 items-center gap-2 rounded-xl border border-prism-text bg-white px-5 text-sm font-bold text-prism-text hover:bg-prism-bg disabled:opacity-60"
        : "inline-flex min-h-9 items-center rounded-full border border-prism-border px-3 py-1.5 text-xs font-bold text-prism-text hover:bg-prism-bg disabled:opacity-60", focusRing)}>
        {variant === "outline" ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
        ) : null}
        {busy ? "Preparing…" : label}
      </button>
      {error ? <span role="alert" className="text-[11px] font-semibold text-red-700">{error}</span> : null}
    </span>
  );
}

export function Notice({ tone: kind = "muted", children }: { tone?: "muted" | "error" | "warn"; children: ReactNode }) {
  const style = kind === "error" ? "border-red-200 bg-red-50 text-red-700" : kind === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-prism-border/70 bg-white text-prism-muted";
  return <div role={kind === "error" ? "alert" : undefined} className={clsx("rounded-2xl border px-4 py-3 text-sm", style)}>{children}</div>;
}

// done / expected with a bar; "n/a" when nothing is expected.
export function RatioBar({ label, done, expected, pct, note }: { label: string; done: number; expected: number; pct: number | null; note?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold text-prism-text">{label}</span>
        <span className="shrink-0 tabular-nums text-prism-muted"><strong className="text-prism-text">{done.toLocaleString("en-GH")}</strong> / {expected.toLocaleString("en-GH")} · {pctText(pct)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-prism-bg" aria-hidden="true">
        <div className={clsx("h-full rounded-full", pct === null ? "" : pct < 50 ? "bg-red-500" : pct < 80 ? "bg-yellow-500" : "bg-emerald-500")} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {note && <p className="mt-0.5 text-[10px] text-prism-muted">{note}</p>}
    </div>
  );
}
