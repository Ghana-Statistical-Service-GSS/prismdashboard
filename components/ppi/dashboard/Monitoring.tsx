"use client";

import Link from "next/link";
import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ppiKeys } from "../api";
import { usePpiQuery } from "../usePpiQuery";
import type { Activity, Attention, AttentionRow, Bottleneck, Overview, Stage } from "./types";
import { age, ATTENTION, ATTENTION_KINDS, attentionLabel, count, day, isAttentionKind, QUESTIONNAIRE_SHORT, STAGE_LONG, STAGE_SHORT, statusText } from "./format";
import { CsvLink, focusRing, Notice, Panel, Pill } from "./ui";

const COLORS = { first: "#7c3aed", final: "#14b8a6", returns: "#f43f5e" };
const BAND_COLORS = ["bg-emerald-400", "bg-yellow-400", "bg-orange-400", "bg-rose-500"];

function bandLabels(days: number[]) {
  const [a, b, c] = days;
  return [`under ${a} day`, `${a}–${b} days`, `${b}–${c} days`, `${c}+ days`];
}

// Pending work at each review stage of the round: queue size, oldest case
// and age bands (configured thresholds).
export function ReviewBottlenecks({ overview, myStage }: { overview: Overview; myStage: Stage | null }) {
  const labels = bandLabels(overview.thresholds.reviewAgeBandsDays);
  const stages = overview.bottlenecks ?? [];
  return (
    <Panel
      id="ppi-bottlenecks"
      title="Review bottlenecks"
      hint={`Cases waiting at each stage of this round (${stages.map((s) => STAGE_SHORT[s.stage]).join(" → ")}), by how long they have waited.`}
      action={<Link href="/ppi/review" className={clsx("inline-flex min-h-9 items-center rounded-full bg-prism-bg px-3 text-xs font-bold text-prism-purple hover:bg-prism-purple hover:text-white", focusRing)}>Review queue →</Link>}
    >
      <ul className="space-y-3">
        {stages.map((s) => <StageRow key={s.stage} stage={s} labels={labels} mine={s.stage === myStage} />)}
      </ul>
    </Panel>
  );
}

function StageRow({ stage, labels, mine }: { stage: Bottleneck; labels: string[]; mine: boolean }) {
  const total = Math.max(stage.waiting, 1);
  return (
    <li className={clsx("rounded-2xl border p-3", mine ? "border-prism-purple/40 bg-prism-purple/5" : "border-prism-border/70")}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-black text-prism-text">
          {STAGE_LONG[stage.stage]}
          {mine && <Pill className="ml-2 bg-prism-purple text-white">Your stage</Pill>}
        </p>
        <p className="text-sm"><span className="text-xl font-black text-prism-text">{count(stage.waiting)}</span> <span className="text-xs text-prism-muted">waiting</span></p>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-prism-bg" aria-hidden="true">
        {stage.bands.map((n, i) => n > 0 && <div key={labels[i]} className={BAND_COLORS[i]} style={{ width: `${(n / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-4">
        {stage.bands.map((n, i) => (
          <li key={labels[i]} className="flex items-center gap-1.5"><span className={`h-2 w-2 shrink-0 rounded-full ${BAND_COLORS[i]}`} aria-hidden="true" /><span className="text-prism-muted">{labels[i]}</span> <strong className="text-prism-text">{n}</strong></li>
        ))}
      </ul>
      {stage.oldest ? (
        <p className="mt-2 text-[11px] text-prism-muted">
          Oldest: <strong className="text-prism-text">{age(stage.oldestDays)}</strong> ·{" "}
          <Link href={`/ppi/review/${stage.oldest.submissionId}`} className={clsx("font-bold text-prism-purple hover:underline", focusRing)}>{stage.oldest.establishmentName}</Link>
          {stage.oldest.regionName ? ` · ${stage.oldest.regionName}` : ""}{stage.oldest.readerName ? ` · ${stage.oldest.readerName}` : ""}
        </p>
      ) : <p className="mt-2 text-[11px] text-prism-muted">Nothing waiting at this stage.</p>}
    </li>
  );
}

// What is outstanding, after the issue's label. A kind without its own
// text (one added on the server later) gets a neutral line, never another
// kind's instruction.
function issueText(row: AttentionRow) {
  switch (row.kind) {
    case "REVIEW_WAITING": return `${age(row.ageDays)} at the ${row.reviewStage ? STAGE_LONG[row.reviewStage] : "review"} stage`;
    case "RETURNED": return `returned ${age(row.ageDays)} ago, not resubmitted${row.returns > 1 ? ` · returned ${row.returns} times` : ""}`;
    case "NO_REFERENCE": return "GPS cannot be verified, so it cannot be submitted until HQ loads a location";
    case "REVENUE_MISMATCH": return `total and categories differ in the server copy (may still be being entered) · last change ${age(row.ageDays)} ago`;
    case "GPS_FAILED": return row.gpsStatus === "TOO_FAR" ? "capture too far from the preloaded location" : "GPS accuracy not good enough";
    case "CURRENCY_MISMATCH": return "re-enter in the specification's currency";
    case "PRICE_MONTH_MISMATCH": {
      const n = row.priceMonthMismatches ?? 0;
      return `${n ? `${count(n)} specification${n === 1 ? "" : "s"}: ` : ""}check which price is right · a warning, it does not block submission`;
    }
    default: return "open the record for details";
  }
}

// Issue pill: blocking problems in rose, the review queue in amber,
// warnings (never blocking) in yellow.
function kindStyle(kind: string) {
  if (kind === "RETURNED" || kind === "REVIEW_WAITING") return "bg-amber-100 text-amber-900";
  if (isAttentionKind(kind) && ATTENTION[kind].warning) return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300";
  return isAttentionKind(kind) ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-800";
}

// Cases where someone has to act, most urgent kind first, oldest first.
export function NeedsAttention({ userId, query, kind, page, onKind, onPage, onOpenEstablishment, csvHref }: {
  userId: string;
  query: string;
  kind: string;
  page: number;
  onKind: (kind: string) => void;
  onPage: (page: number) => void;
  onOpenEstablishment: (initiationId: string) => void;
  csvHref: string;
}) {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  params.set("pageSize", "8");
  if (kind) params.set("kind", kind);
  // One request: the page of the chosen kind and every kind's count.
  const list = usePpiQuery<Attention>(ppiKeys.dashboard("attention", userId, params.toString()), `/attention?${params}`);
  const kinds = list.data?.kinds ?? {};
  const allCount = Object.values(kinds).reduce((n, v) => n + (v ?? 0), 0);
  // Every kind with cases gets a chip (the known ones in their order, then
  // any the screen does not know yet), so the chips add up to "All".
  const chips = [...ATTENTION_KINDS, ...Object.keys(kinds).filter((k) => !isAttentionKind(k))]
    .filter((k) => (kinds[k] ?? 0) > 0 || kind === k);
  const rows = list.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 8));
  return (
    <Panel id="ppi-attention" title="Needs attention" hint="Cases waiting for someone to act, with the responsible reader and team." action={<CsvLink href={csvHref} />}>
      <div role="group" aria-label="Issue" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button type="button" aria-pressed={!kind} onClick={() => onKind("")} className={clsx("min-h-9 shrink-0 rounded-full px-3 text-xs font-bold", focusRing, !kind ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted")}>All {list.data ? count(allCount) : ""}</button>
        {chips.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => onKind(k)} className={clsx("min-h-9 shrink-0 rounded-full px-3 text-xs font-bold", focusRing, kind === k ? "bg-prism-purple text-white" : "bg-prism-bg text-prism-muted")}>
            {attentionLabel(k)} {count(kinds[k] ?? 0)}
          </button>
        ))}
      </div>
      {list.error && <div className="mt-3"><Notice tone="error">{list.error}</Notice></div>}
      <ul className={clsx("mt-3 divide-y divide-prism-border/60", list.loading && "opacity-60")}>
        {!rows.length && <li className="py-8 text-center text-sm text-prism-muted">{list.loading ? "Loading…" : "Nothing needs attention in this view."}</li>}
        {rows.map((row) => (
          <li key={`${row.kind}-${row.establishmentId}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-prism-text">{row.establishmentName} <span className="font-normal text-prism-muted">· {row.establishmentCode} · {QUESTIONNAIRE_SHORT[row.questionnaireType]}</span></p>
              <p className="text-[11px] text-prism-muted">{[row.districtName, row.regionName].filter(Boolean).join(", ")} · Reader {row.readerName ?? "—"} · Supervisor {row.supervisorName ?? "—"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <Pill className={kindStyle(row.kind)}><span className="sr-only">{isAttentionKind(row.kind) && ATTENTION[row.kind].warning ? "Warning: " : "Issue: "}</span>{attentionLabel(row.kind)}</Pill>
                <span className="font-semibold text-prism-text">{issueText(row)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Pill className="bg-prism-bg text-prism-text">{statusText(row.status, row.reviewStage)}</Pill>
              {row.currentSubmissionId ? (
                <Link href={`/ppi/review/${row.currentSubmissionId}`} className={clsx("inline-flex min-h-9 items-center rounded-full bg-prism-purple px-3 text-[11px] font-bold text-white", focusRing)}>{row.kind === "REVIEW_WAITING" ? "Review" : "Open"}</Link>
              ) : row.initiationId ? (
                <button type="button" onClick={() => onOpenEstablishment(row.initiationId!)} className={clsx("min-h-9 rounded-full bg-prism-bg px-3 text-[11px] font-bold text-prism-purple", focusRing)}>Open</button>
              ) : <span className="text-[11px] text-prism-muted">No record yet</span>}
            </div>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Attention pages" className="mt-2 flex items-center justify-end gap-2 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={clsx("min-h-9 rounded-full border border-prism-border px-3 font-bold disabled:opacity-35", focusRing)}>Previous</button>
          <span className="text-prism-muted">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={clsx("min-h-9 rounded-full border border-prism-border px-3 font-bold disabled:opacity-35", focusRing)}>Next</button>
        </nav>
      )}
    </Panel>
  );
}

// The last n calendar days, ending today.
function lastDays(n: number): [string, string] {
  const end = new Date();
  const start = new Date(end.getTime() - (n - 1) * 86_400_000);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

// Activity in a date range. The range changes only this panel: every other
// figure is the round's current status, so no denominator moves with it.
export function CollectionActivity({ userId, query, from, to, onRange }: {
  userId: string;
  query: string;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
}) {
  const params = new URLSearchParams(query);
  params.set("from", from);
  params.set("to", to);
  const data = usePpiQuery<Activity>(ppiKeys.dashboard("activity", userId, params.toString()), `/activity?${params}`);
  const days = data.data?.days ?? [];
  const totals = data.data?.totals;
  const preset = (n: number) => onRange(...lastDays(n));
  return (
    <Panel
      id="ppi-activity"
      title="Collection activity"
      hint="Daily first submissions and final approvals in the activity period (Ghana time). This period does not change the round's current figures above."
      action={
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col font-bold text-prism-muted">From
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && onRange(e.target.value, to)} className={clsx("mt-0.5 min-h-9 rounded-xl border border-prism-border px-2 text-prism-text", focusRing)} />
          </label>
          <label className="flex flex-col font-bold text-prism-muted">To
            <input type="date" value={to} min={from} onChange={(e) => e.target.value && onRange(from, e.target.value)} className={clsx("mt-0.5 min-h-9 rounded-xl border border-prism-border px-2 text-prism-text", focusRing)} />
          </label>
          <span className="flex gap-1">
            {[7, 30, 90].map((n) => <button key={n} type="button" onClick={() => preset(n)} className={clsx("min-h-9 rounded-full bg-prism-bg px-3 font-bold text-prism-muted hover:text-prism-text", focusRing)}>{n} days</button>)}
          </span>
        </div>
      }
    >
      {data.error && <Notice tone="error">{data.error}</Notice>}
      {totals && (
        <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5">
          {[["First submissions", totals.firstSubmissions], ["Resubmissions", totals.resubmissions], ["Final approvals", totals.finalApprovals], ["Stage approvals", totals.stageApprovals], ["Returns", totals.returns]].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl bg-prism-bg/70 px-3 py-2"><dt className="text-prism-muted">{label}</dt><dd className="text-lg font-black text-prism-text">{count(value as number)}</dd></div>
          ))}
        </dl>
      )}
      <figure className={clsx("mt-4", data.loading && "opacity-60")}>
        <figcaption className="sr-only">{totals ? `From ${from} to ${to}: ${totals.firstSubmissions} first submissions and ${totals.finalApprovals} final approvals. The daily figures are in the table below the chart.` : "Loading activity."}</figcaption>
        <div className="h-64 min-w-0" aria-hidden="true">
          {/* A fixed height: with "100%" the first render, before the
              container is measured, logs Recharts' width(-1)/height(-1)
              warning; the chart itself waits for a measured width. */}
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={days} margin={{ left: -16, right: 8, top: 8 }} barCategoryGap="12%" barGap={1}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" tickFormatter={day} tick={{ fontSize: 10 }} minTickGap={16} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(v) => day(String(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="firstSubmissions" name="First submissions" fill={COLORS.first} radius={[4, 4, 0, 0]} />
              <Bar dataKey="finalApprovals" name="Final approvals" fill={COLORS.final} radius={[4, 4, 0, 0]} />
              <Bar dataKey="returns" name="Returns" fill={COLORS.returns} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <details className="mt-2 text-xs">
        <summary className={clsx("cursor-pointer font-bold text-prism-purple", focusRing)}>Daily figures as a table</summary>
        <div className="relative mt-2 max-h-64 overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-[0.1em] text-prism-muted">
              <tr><th scope="col" className="py-1.5 pr-3">Day</th><th scope="col" className="px-2 text-right">First submissions</th><th scope="col" className="px-2 text-right">Resubmissions</th><th scope="col" className="px-2 text-right">Final approvals</th><th scope="col" className="px-2 text-right">Stage approvals</th><th scope="col" className="px-2 text-right">Returns</th></tr>
            </thead>
            <tbody>
              {days.filter((d) => d.firstSubmissions + d.resubmissions + d.finalApprovals + d.stageApprovals + d.returns > 0).map((d) => (
                <tr key={d.day} className="border-t border-prism-border/50 tabular-nums">
                  <th scope="row" className="py-1.5 pr-3 text-left font-semibold">{day(d.day)}</th>
                  <td className="px-2 text-right">{d.firstSubmissions}</td><td className="px-2 text-right">{d.resubmissions}</td><td className="px-2 text-right">{d.finalApprovals}</td><td className="px-2 text-right">{d.stageApprovals}</td><td className="px-2 text-right">{d.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totals && !(totals.firstSubmissions + totals.resubmissions + totals.finalApprovals + totals.stageApprovals + totals.returns) && <p className="py-3 text-prism-muted">No activity in this period.</p>}
        </div>
      </details>
    </Panel>
  );
}
