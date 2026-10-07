"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DashboardModeSwitch } from "@/components/dashboard/DashboardModeSwitch";
import { OverviewPanel } from "@/components/rebasing/OverviewPanel";
import { PriceReviewPanel } from "@/components/rebasing/PriceReviewPanel";
import { CarryForwardPanel } from "@/components/rebasing/CarryForwardPanel";
import { AssignmentsPanel } from "@/components/rebasing/AssignmentsPanel";
import Link from "next/link";
import { Period, Week, formatDay, number, periodLabel, rebasingApi } from "@/components/rebasing/api";
import { useRebasingQuery } from "@/components/rebasing/useRebasingQuery";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";

type Tab = "overview" | "prices" | "carryovers" | "assignments";

const WEEK_STATUS: Record<Week["effective_status"], { label: string; style: string }> = {
  ACTIVE: { label: "Active", style: "bg-emerald-100 text-emerald-800" },
  NOT_STARTED: { label: "Upcoming", style: "bg-slate-100 text-prism-muted" },
  ENDED: { label: "Ended", style: "bg-amber-100 text-amber-800" },
  CLOSED: { label: "Closed", style: "bg-slate-200 text-prism-text" },
  NOT_OPEN: { label: "Not open", style: "bg-slate-100 text-prism-muted" },
};

function pickDefaultPeriod(periods: Period[]) {
  return periods.find((p) => p.status === "OPEN" && p.period_type === "NORMAL")
    || periods.find((p) => p.status === "OPEN")
    || periods[0]
    || null;
}

export default function MarketReadingDashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  // undefined = "not chosen yet": fall back to the server's active week.
  const [weekChoice, setWeekChoice] = useState<{ periodId: string | null; weekId: string | null | undefined }>({ periodId: null, weekId: undefined });
  const [tab, setTab] = useState<Tab>("overview");
  const [badges, setBadges] = useState({ prices: 0, carryovers: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  // Periods are managed in Configuration › Collection Calendar.
  const periodsVersion = 0;

  useEffect(() => {
    let active = true;
    Promise.all([loadDashboardUser(), rebasingApi<{ periods: Period[] }>("/periods")])
      .then(([dashboardUser, data]) => {
        if (!active) return;
        setUser(dashboardUser);
        setPeriods(data.periods);
        // Keep the month being viewed unless it no longer exists.
        setPeriodId((current) => (current && data.periods.some((p) => p.period_id === current)
          ? current
          : pickDefaultPeriod(data.periods)?.period_id || null));
      })
      .catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [periodsVersion]);

  const isHq = user?.role === "HQ" || user?.role === "ADMIN";
  const periodDetail = useRebasingQuery<{ weeks: Week[] }>(periodId ? `/periods/${periodId}` : null, periodsVersion);
  const weeks = periodDetail.loading ? [] : periodDetail.data?.weeks || [];
  const chosen = weekChoice.periodId === periodId ? weekChoice.weekId : undefined;
  const weekId = chosen !== undefined ? chosen : weeks.find((week) => week.effective_status === "ACTIVE")?.week_id || null;
  const setWeekId = (next: string | null) => setWeekChoice({ periodId, weekId: next });

  // Tab badges: what is waiting for *this* user.
  useEffect(() => {
    if (!periodId || !user) return;
    let active = true;
    const reviewer = user.role === "SUPERVISOR" || user.role === "REGIONAL_STATISTICIAN";
    Promise.all([
      rebasingApi<{ total: number }>(`/price-reviews?periodId=${periodId}&pageSize=1`).catch(() => ({ total: 0 })),
      reviewer ? rebasingApi<{ carryovers: unknown[] }>(`/carryovers?periodId=${periodId}`).catch(() => ({ carryovers: [] })) : Promise.resolve({ carryovers: [] }),
    ]).then(([prices, carryovers]) => {
      if (active) setBadges({ prices: prices.total, carryovers: carryovers.carryovers.length });
    });
    return () => { active = false; };
  }, [periodId, user, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState("");

  // HQ/Admin open or close the month's reference-fix window. Readers pick the
  // change up on their next Download Setup; the server applies it at sync.
  const toggleReferenceFix = async (target: Period) => {
    const open = !target.reference_fix_open;
    const message = open
      ? `Allow Market Readers to fix the previous price, unit, brand and description for ${periodLabel(target)}? Each fix needs a reason and is shown to reviewers. The frozen reference is not changed.`
      : `Stop reference fixes for ${periodLabel(target)}? Fixes already on phones but not yet synced will be refused.`;
    if (!window.confirm(message)) return;
    setFixBusy(true);
    setFixError("");
    try {
      const data = await rebasingApi<{ period: Period }>(`/periods/${target.period_id}/reference-fix`, { method: "POST", body: { open } });
      setPeriods((current) => current?.map((p) => (p.period_id === target.period_id ? { ...p, ...data.period } : p)) || current);
    } catch (reason) {
      setFixError(reason instanceof Error ? reason.message : "Could not change reference fixes");
    } finally {
      setFixBusy(false);
    }
  };
  const period = periods?.find((p) => p.period_id === periodId) || null;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "prices", label: "Price approvals", badge: badges.prices },
    { id: "carryovers", label: "Carry-forward", badge: badges.carryovers },
    { id: "assignments", label: "Assignments" },
  ];

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Rebasing · monthly collection</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-prism-text sm:text-3xl md:text-4xl">Market Reading Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-prism-muted">
                {user?.role === "SUPERVISOR"
                  ? "Weekly outlet progress, price approvals and carry-forward requests for your assigned markets."
                  : user?.role === "REGIONAL_STATISTICIAN"
                    ? `Weekly outlet progress, price approvals and carry-forward requests in ${user.region_name || "your region"}.`
                    : "National weekly outlet progress and the final stage of price approval."}
              </p>
            </div>
            <DashboardModeSwitch active="reading" />
          </section>

          {(error || periodDetail.error) && <div role="alert" className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || periodDetail.error}</div>}
          {!periods && !error && <div className="mt-6 rounded-3xl bg-white p-10 text-center text-sm text-prism-muted shadow-sm">Loading collection periods…</div>}
          {periods && periods.length === 0 && user && (
            <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm">
              <p className="text-base font-black text-prism-text">No Market Reading month yet</p>
              <p className="mt-1 text-sm text-prism-muted">HQ creates and opens a collection month before readers can start pricing.</p>
              {isHq && (
                <Link href="/collection-calendar" className="mt-4 inline-flex rounded-full bg-prism-purple px-5 py-2.5 text-xs font-bold text-white hover:brightness-110">
                  Set up in Collection Calendar
                </Link>
              )}
            </div>
          )}

          {period && user && (
            <>
              {/* Period + week context */}
              <section className="mt-6 rounded-3xl border border-prism-border/70 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-prism-muted">Observation month</span>
                    <select value={periodId || ""} onChange={(event) => setPeriodId(event.target.value)} className="rounded-xl border border-prism-border bg-white px-3 py-2.5 text-sm font-bold text-prism-text">
                      {periods?.map((p) => <option key={p.period_id} value={p.period_id}>{periodLabel(p)} · {p.status}</option>)}
                    </select>
                  </label>
                  <p className="text-xs text-prism-muted">
                    {number.format(period.market_plan_count)} markets · {number.format(period.total_outlets)} outlets frozen at open
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-900">
                      Reference fixes · <span className={period.reference_fix_open ? "text-emerald-700" : "text-prism-muted"}>{period.reference_fix_open ? "Open" : "Closed"}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-900/80">
                      {period.reference_fix_open
                        ? "Market Readers can fix the previous price, unit, brand and description while pricing (with a reason)."
                        : "Market Readers price against the reference as it is."}
                      {period.reference_fix_changed_at ? ` Last changed ${new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(period.reference_fix_changed_at))}.` : ""}
                    </p>
                    {fixError && <p role="alert" className="mt-1 text-[11px] font-semibold text-red-700">{fixError}</p>}
                  </div>
                  {(user.role === "HQ" || user.role === "ADMIN") && period.status !== "CLOSED" && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={period.reference_fix_open}
                      disabled={fixBusy}
                      onClick={() => toggleReferenceFix(period)}
                      className={clsx("shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition disabled:opacity-50", period.reference_fix_open ? "bg-white text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100" : "bg-amber-500 text-white hover:bg-amber-600")}
                    >
                      {fixBusy ? "Saving…" : period.reference_fix_open ? "Close reference fixes" : "Open reference fixes"}
                    </button>
                  )}
                </div>

                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
                  <button type="button" onClick={() => setWeekId(null)} className={clsx("shrink-0 rounded-2xl border px-4 py-2.5 text-left transition", weekId === null ? "border-prism-purple bg-prism-purple text-white" : "border-prism-border bg-white text-prism-text hover:border-prism-purple/40")}>
                    <span className="block text-xs font-black">Whole month</span>
                    <span className={clsx("block text-[10px]", weekId === null ? "text-white/70" : "text-prism-muted")}>All weeks</span>
                  </button>
                  {weeks.map((week) => {
                    const selected = week.week_id === weekId;
                    const status = WEEK_STATUS[week.effective_status];
                    return (
                      <button key={week.week_id} type="button" onClick={() => setWeekId(week.week_id)} className={clsx("shrink-0 rounded-2xl border px-4 py-2.5 text-left transition", selected ? "border-prism-purple bg-prism-purple text-white" : "border-prism-border bg-white text-prism-text hover:border-prism-purple/40")}>
                        <span className="flex items-center gap-2 text-xs font-black">
                          {week.week_type === "CATCH_UP" ? "Catch-up" : `Week ${week.week_no}`}
                          <span className={clsx("rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase", selected ? "bg-white/20 text-white" : status.style)}>{status.label}</span>
                        </span>
                        <span className={clsx("block text-[10px]", selected ? "text-white/70" : "text-prism-muted")}>{formatDay(week.start_date)} – {formatDay(week.end_date)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Tabs */}
              <nav aria-label="Market Reading sections" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-prism-border bg-white p-1.5 shadow-sm sm:inline-grid sm:w-auto sm:auto-cols-auto sm:grid-flow-col sm:rounded-full">
                {tabs.map((item) => (
                  <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={clsx("flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-bold transition sm:rounded-full sm:px-5 sm:text-xs", tab === item.id ? "bg-prism-purple text-white" : "text-prism-muted hover:text-prism-text")}>
                    <span className="truncate">{item.label}</span>
                    {item.badge ? <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px] font-black", tab === item.id ? "bg-white text-prism-purple" : "bg-prism-pink text-white")}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
                  </button>
                ))}
              </nav>

              {tab === "overview" && (
                <OverviewPanel
                  key={`${period.period_id}-${weekId}-${refreshKey}`}
                  periodId={period.period_id}
                  weekId={weekId}
                  role={user.role}
                  onOpenReviews={() => setTab("prices")}
                  onOpenCarryovers={() => setTab("carryovers")}
                />
              )}
              {tab === "prices" && <PriceReviewPanel key={period.period_id} periodId={period.period_id} role={user.role} onChanged={refresh} />}
              {tab === "carryovers" && <CarryForwardPanel key={period.period_id} periodId={period.period_id} role={user.role} onChanged={refresh} />}
              {tab === "assignments" && <AssignmentsPanel key={period.period_id} periodId={period.period_id} periodName={periodLabel(period)} role={user.role} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
