"use client";

import Link from "next/link";
import clsx from "clsx";
import type { Overview, Stage, WorkflowStatus } from "./types";
import { age, count, dateTime, SERIES_LABEL, STAGE_SHORT, STATUS, SYNC } from "./format";
import { focusRing, MetricCard, PageLink } from "./ui";
import type { StatePatch } from "./useDashboardState";

type Props = {
  overview: Overview;
  href: (patch: StatePatch) => string;
  canListReaders: boolean;
};

// The six headline figures for the round's current status (never the
// activity period), each linking to the list behind it.
export function HeadlineCards({ overview, href, canListReaders }: Props) {
  const h = overview.headline!;
  const stages = overview.round?.reviewStages ?? ["SUPERVISOR"];
  const list = (status: string) => href({ view: "establishment", status, initiationId: null, page: null });
  const [, threshold] = overview.thresholds.reviewAgeBandsDays;
  const waitingLong = (overview.bottlenecks ?? []).reduce((n, b) => n + b.bands[2] + b.bands[3], 0);
  const oldest = Math.max(...(overview.bottlenecks ?? []).map((b) => b.oldestDays ?? 0), 0);
  const series = (["SELLING", "PURCHASE", "CONTRACT"] as const).filter((s) => h.observations.current[s] + h.observations.history[s] > 0);
  const last = stages[stages.length - 1];
  const reader = overview.scope.level === "READER";

  const submittedCard = (
    <MetricCard
      label="Establishments submitted"
      value={count(h.submitted)}
      accent="teal"
      pct={h.coverage}
      pctLabel="Submitted of assigned"
      hint={<>of {count(h.assigned)} assigned · {count(h.events)} submission{h.events === 1 ? "" : "s"} ({count(h.resubmissions)} resubmission{h.resubmissions === 1 ? "" : "s"})</>}
      href={list("submitted")}
      linkLabel="Submitted establishments"
    />
  );
  const observationsCard = (
    <MetricCard
      label="Price observations received"
      value={count(h.observations.total)}
      accent="purple"
      hint={<>{count(h.observations.currentTotal)} current · {count(h.observations.historyTotal)} monthly history · latest submitted versions only</>}
      href={list("submitted")}
      linkLabel="By establishment"
    >
      <p className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-prism-text">
        {series.length ? series.map((s) => (
          <span key={s} className="rounded-full bg-prism-bg px-2 py-0.5">{SERIES_LABEL[s]} {count(h.observations.current[s] + h.observations.history[s])}</span>
        )) : <span className="text-prism-muted">No submitted prices yet</span>}
      </p>
      {h.unmeasured > 0 && <p className="mt-1 text-[10px] text-amber-800">{count(h.unmeasured)} submission(s) still being counted</p>}
    </MetricCard>
  );
  const approvedCard = (
    <MetricCard
      label="Finally approved"
      value={count(h.approved)}
      accent="teal"
      pct={h.approvedCoverage}
      pctLabel="Finally approved of assigned"
      hint={<>of {count(h.assigned)} assigned · final at the {STAGE_SHORT[last]} stage; earlier approvals are still under review</>}
      href={list("approved")}
      linkLabel="Approved establishments"
    />
  );
  const awaitingCard = (
    <MetricCard
      label="Awaiting review"
      value={count(h.awaiting)}
      accent="amber"
      hint={<>{stages.map((s: Stage) => `${STAGE_SHORT[s]} ${count(h.awaitingByStage[s])}`).join(" · ")}</>}
      href={list("awaiting")}
      linkLabel="Waiting cases"
    >
      <p className={clsx("mt-2 text-[11px] font-bold", waitingLong ? "text-rose-700" : "text-prism-muted")}>
        {h.awaiting ? <>{waitingLong ? `⚠ ${count(waitingLong)} waiting ${threshold}+ days` : `None waiting ${threshold}+ days`} · oldest {age(oldest)}</> : "Nothing waiting"}
      </p>
    </MetricCard>
  );
  const returnedCard = (
    <MetricCard
      label={reader ? "Returned to you" : "Returned for correction"}
      value={count(h.returned)}
      accent="rose"
      hint={h.returned ? <>oldest returned {age(h.oldestReturnDays)} ago{reader ? " · correct and resubmit" : ""}</> : "No correction outstanding"}
      href={list("returned")}
      linkLabel="Returned establishments"
    >
      <p className={clsx("mt-2 text-[11px] font-bold", h.returnedRepeat ? "text-rose-700" : "text-prism-muted")}>
        {h.returnedRepeat ? `↻ ${count(h.returnedRepeat)} returned twice or more` : "No repeat returns"}
      </p>
    </MetricCard>
  );

  if (reader) {
    const sync = overview.sync;
    const state = sync ? (sync.never ? "NEVER" : sync.stale ? "STALE" : sync.inactive ? "INACTIVE" : "CURRENT") : null;
    const remaining = h.notStarted + h.inProgress + h.returned;
    return (
      <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Establishments remaining" value={count(remaining)} accent="pink" hint={<>of {count(h.assigned)} assigned · {count(h.notStarted)} not started · {count(h.inProgress)} in progress</>} href={list("open")} linkLabel="Remaining" />
        {submittedCard}
        {observationsCard}
        {returnedCard}
        {approvedCard}
        <MetricCard label="Sync status" value={state ? SYNC[state].label : "—"} accent="slate" hint={<>Last download {dateTime(sync?.lastDownloadAt)} · last upload {dateTime(sync?.lastUploadAt)}{sync?.refused ? " · refusals in the last upload" : ""}</>} />
      </section>
    );
  }

  return (
    <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
      {submittedCard}
      {observationsCard}
      {approvedCard}
      {awaitingCard}
      {returnedCard}
      <MetricCard
        label="Readers reporting"
        value={`${count(h.readers.reporting)} / ${count(h.readers.assigned)}`}
        accent="pink"
        pct={h.readers.rate}
        pctLabel="Readers who have submitted"
        hint="assigned readers with at least one accepted submission; signing in or syncing alone does not count"
        href={canListReaders ? href({ view: "reader", initiationId: null, status: null, page: null }) : undefined}
        linkLabel="Readers"
      />
    </section>
  );
}

const STRIP: { key: WorkflowStatus; stage?: Stage; color: string; status: string }[] = [
  { key: "NOT_STARTED", color: "bg-slate-300", status: "not_started" },
  { key: "IN_PROGRESS", color: "bg-sky-400", status: "in_progress" },
  { key: "SUBMITTED", stage: "SUPERVISOR", color: "bg-amber-400", status: "awaiting_supervisor" },
  { key: "SUBMITTED", stage: "RS", color: "bg-orange-400", status: "awaiting_rs" },
  { key: "SUBMITTED", stage: "HQ", color: "bg-prism-purple", status: "awaiting_hq" },
  { key: "RETURNED", color: "bg-rose-500", status: "returned" },
  { key: "APPROVED", color: "bg-emerald-500", status: "approved" },
];

// Where every assigned establishment is now (the buckets add up to the
// assigned total), in the pattern of CPI's approval pipeline. HQ (who
// decides removal recommendations) also sees how many wait for it.
export function WorkflowStrip({ overview, href, decidesRemovals }: { overview: Overview; href: (patch: StatePatch) => string; decidesRemovals: boolean }) {
  const h = overview.headline!;
  const removal = overview.removalRecommendations;
  const buckets = STRIP.filter((s) => !s.stage || overview.round?.reviewStages.includes(s.stage)).map((s) => ({
    ...s,
    label: s.stage ? `Awaiting ${STAGE_SHORT[s.stage]}` : STATUS[s.key].label,
    value: overview.workflow?.find((w) => w.status === s.key && (w.stage ?? null) === (s.stage ?? null))?.count ?? 0,
  }));
  const total = Math.max(h.assigned, 1);
  return (
    <section aria-labelledby="ppi-workflow-title" className="rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="ppi-workflow-title" className="text-base font-black text-prism-text">Current status of assigned establishments</h2>
          <p className="mt-1 text-xs text-prism-muted">Each of the {count(h.assigned)} assigned establishments is in exactly one state. Submitted establishments stay counted when returned or approved.</p>
        </div>
        <div className="space-y-0.5 text-[11px] font-bold">
          {h.unassignedInitiations > 0 && (
            <p className="text-amber-800">{count(h.unassignedInitiations)} started initiation(s) have no active assignment and are not counted.</p>
          )}
          {decidesRemovals && removal && removal.open > 0 && (
            <p>
              {/* The review queue has no removal filter yet: it opens on its default list. */}
              <Link href="/ppi/review" className={clsx("text-prism-purple hover:underline", focusRing)}>Open removal recommendations: {count(removal.open)} →</Link>
            </p>
          )}
          {removal && removal.removed > 0 && (
            <p className="text-prism-muted">{count(removal.removed)} establishment(s) removed from the round by HQ are not counted.</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-prism-bg" aria-hidden="true">
        {buckets.map((b) => b.value > 0 && <div key={b.label} className={b.color} style={{ width: `${(b.value / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {buckets.map((b) => (
          <li key={b.label}>
            <PageLink href={href({ view: "establishment", status: b.status, initiationId: null, page: null })} className={clsx("block rounded-2xl bg-prism-bg/70 px-3 py-2 hover:bg-prism-bg", focusRing)}>
              <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.color}`} aria-hidden="true" /><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-prism-muted">{b.label}</span></span>
              <span className="mt-0.5 block text-lg font-black text-prism-text">{count(b.value)}</span>
            </PageLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
