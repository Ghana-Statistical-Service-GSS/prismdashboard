"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useRef, useState } from "react";
import clsx from "clsx";
import {
  amountText, codedText, formatDateTime, formatDecimal, PpiApiError, ppiApi, ppiKeys, QUESTIONNAIRE_LABEL, STAGE_LABEL,
  type AuditChange, type Category, type Product, type ReviewIssue, type Snapshot, type Specification, type SubmissionDetail,
} from "./api";
import { invalidatePpi, usePpiQuery } from "./usePpiQuery";

// One submitted version, reviewed page by page: the reviewer marks each page
// reviewed (kept on the server per reviewer and submission) and can decide
// only when every page is marked; the server refuses a decision otherwise.

type PageId = "ESTABLISHMENT" | "REVENUE" | "PRODUCTS" | "HISTORY";
const PAGES: { id: PageId; title: string }[] = [
  { id: "ESTABLISHMENT", title: "Establishment & location" },
  { id: "REVENUE", title: "Revenue & categories" },
  { id: "PRODUCTS", title: "Products & prices" },
  { id: "HISTORY", title: "Review history" },
];

// General information compared with the preloaded assignment (region and
// district are stored as ids in the preload; they show in the location).
const COMPARED: [string, string][] = [
  ["establishmentName", "Establishment name"], ["questionnaireType", "Questionnaire"], ["townLocality", "Town / locality"], ["suburb", "Suburb"],
  ["locationDescription", "Exact location"], ["tin", "TIN"], ["contactPersonName", "Contact person"], ["contactPersonPhone", "Contact phone"],
  ["contactPersonEmail", "Contact email"], ["establishmentPhone", "Establishment phone"], ["establishmentEmail", "Establishment email"], ["website", "Website"],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const monthName = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const SERIES_LABEL: Record<string, string> = { SELLING: "Selling price", PURCHASE: "Purchase price", CONTRACT: "Contract price" };

type Draft = ReviewIssue & { label: string };
// Something a review comment can point at.
type Target = { key: string; entityType: string; recordId: string; field: string | null; label: string; context?: string };
const target = (entityType: string, recordId: string, field: string | null, label: string, context?: string): Target =>
  ({ key: `${entityType}:${recordId}:${field ?? ""}`, entityType, recordId, field, label, context });
type CommentFor = (t: Target) => ReactNode;

// The stage a decision was taken ahead of (an RS before the Supervisor, HQ
// before either), from where the case waited ("SUBMITTED:SUPERVISOR"); null
// when it was decided at its own stage.
const aheadOf = (stage: string, statusBefore?: string) => {
  const waited = statusBefore?.startsWith("SUBMITTED:") ? statusBefore.slice("SUBMITTED:".length) : null;
  return waited && waited !== stage ? waited : null;
};

export function SubmissionReview({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const detail = usePpiQuery<SubmissionDetail>(ppiKeys.submission(submissionId), `/submissions/${submissionId}`);
  const [pageIndex, setPageIndex] = useState(0);
  const [issues, setIssues] = useState<Draft[]>([]);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentTab, setCommentTab] = useState<"add" | "all">("add");
  // Pages marked in this visit (the server's answer to the last mark).
  const [marked, setMarked] = useState<string[] | null>(null);
  const [marking, setMarking] = useState(false);
  const [dialog, setDialog] = useState<"APPROVED" | "RETURNED" | null>(null);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "error"; text: string; stale?: boolean } | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const commentBox = useRef<HTMLTextAreaElement>(null);

  if (detail.error && !detail.data) return <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{detail.error}</p>;
  if (!detail.data) return <p className="text-sm text-prism-muted">Loading…</p>;
  const d = detail.data;
  const snap = d.submission.snapshot;
  const est = snap.establishment;
  const interview = snap.initiation;
  const canComment = d.canDecide;
  const page = PAGES[pageIndex];
  const last = pageIndex === PAGES.length - 1;

  // The checklist applies to a reviewer who can decide, on a server that
  // keeps it (an older server sends no reviewProgress: no checklist).
  const checklist = d.canDecide && !!d.reviewProgress;
  const reviewed = marked ?? d.reviewProgress?.reviewed ?? [];
  const reviewedCount = PAGES.filter((p) => reviewed.includes(p.id)).length;
  const complete = !checklist || reviewedCount === PAGES.length;
  const pageReviewed = reviewed.includes(page.id);

  const stages = d.reviewStages?.length ? d.reviewStages : ["SUPERVISOR", "RS", "HQ"];
  const decidingAt = d.decidesAt ?? d.initiation.reviewStage;
  const nextStage = decidingAt && stages.includes(decidingAt) ? stages[stages.indexOf(decidingAt) + 1] ?? null : null;

  const targets = buildTargets(d);
  const pageTargets = targets[page.id];
  const selected = pageTargets.find((t) => t.key === targetKey) ?? pageTargets[0];

  const goTo = (index: number) => {
    setPageIndex(index);
    setTargetKey(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const commentFor: CommentFor = (t) => (canComment ? (
    <button
      type="button"
      onClick={() => { setTargetKey(t.key); setCommentTab("add"); commentBox.current?.focus(); }}
      className={clsx("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-prism-purple hover:bg-prism-bg", issues.some((i) => keyOf(i) === t.key) && "bg-violet-100")}
      aria-label={`Comment on ${t.label}`}
      title={`Comment on ${t.label}`}
    >
      <CommentIcon />
    </button>
  ) : null);

  const saveComment = (event: FormEvent) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || !selected) return;
    const draft: Draft = { entityType: selected.entityType, recordId: selected.recordId, field: selected.field, comment: text, label: selected.label };
    setIssues((list) => (list.some((i) => keyOf(i) === selected.key) ? list.map((i) => (keyOf(i) === selected.key ? draft : i)) : [...list, draft]));
    setCommentText("");
  };

  const markPage = async () => {
    setMarking(true);
    try {
      const r = await ppiApi<{ pages: string[]; reviewed: string[] }>(`/submissions/${submissionId}/review-progress`, { method: "POST", body: { page: page.id } });
      setMarked(r.reviewed);
      invalidatePpi(ppiKeys.submission(submissionId));
      if (!last) goTo(pageIndex + 1);
    } catch (error) {
      setOutcome({ tone: "error", text: (error as PpiApiError).message });
    } finally {
      setMarking(false);
    }
  };

  const decide = async (decision: "APPROVED" | "RETURNED", reason: string, note: string) => {
    try {
      await ppiApi(`/submissions/${submissionId}/decision`, {
        method: "POST",
        body: {
          decision, reason: reason || undefined, comment: note || undefined, expectedInitiationVersion: d.initiation.version,
          issues: decision === "RETURNED" ? issues.map(({ entityType, recordId, field, comment: text }) => ({ entityType, recordId, field, comment: text })) : [],
        },
      });
      setDialog(null);
      setIssues([]);
      setOutcome({ tone: "ok", text: decision === "APPROVED" ? "Approved." : "Returned to the enumerator for correction." });
      invalidatePpi("ppi:");
    } catch (error) {
      setDialog(null);
      const e = error as PpiApiError;
      const stale = e.status === 409;
      if (e.code === "REVIEW_INCOMPLETE") { setMarked(null); invalidatePpi(ppiKeys.submission(submissionId)); }
      setOutcome({
        tone: "error",
        stale,
        text: stale
          ? `${e.message} Nothing was recorded. Reload to see the current state.`
          : e.errors?.length ? `${e.message} ${e.errors.map((x) => x.message).join(" ")}` : e.message,
      });
    }
  };

  const status = d.initiation.workflowStatus === "SUBMITTED"
    ? `${STAGE_LABEL[d.initiation.reviewStage ?? ""] ?? "In"} review`
    : d.initiation.workflowStatus === "RETURNED" ? "Returned for correction" : d.initiation.workflowStatus === "APPROVED" ? "Approved" : "In progress";

  return (
    <article className="pb-40">
      <Link href="/ppi/review" className="inline-flex items-center gap-1 text-sm font-bold text-prism-purple">← Review queue</Link>

      <header className="mt-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prism-border/60 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-prism-text">{est.general.establishmentName || "—"}</h1>
            <p className="mt-1 text-sm font-semibold text-prism-muted">{est.establishmentCode} · {QUESTIONNAIRE_LABEL[interview.questionnaireType] ?? interview.questionnaireType}</p>
            <p className="text-sm text-prism-muted">Submitted by {d.submission.submittedByName} · {formatDateTime(d.submission.submittedAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={clsx("rounded-full px-4 py-2 text-sm font-bold", d.initiation.workflowStatus === "RETURNED" ? "bg-rose-50 text-rose-800" : d.initiation.workflowStatus === "APPROVED" ? "bg-emerald-50 text-emerald-800" : "bg-violet-100 text-prism-purple")}>{status}</span>
            <label className="sr-only" htmlFor="ppi-submission">Submission</label>
            <select
              id="ppi-submission"
              value={submissionId}
              onChange={(e) => router.push(`/ppi/review/${e.target.value}`)}
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-prism-border"
            >
              {d.submissions.map((s) => (
                <option key={s.submissionId} value={s.submissionId}>
                  Submission {s.submissionNo}{s.submissionId === d.initiation.currentSubmissionId ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Stepper stages={stages} workflowStatus={d.initiation.workflowStatus} reviewStage={d.initiation.reviewStage} />
      </header>

      <div className="mt-4 space-y-3">
        {!d.isCurrent ? (
          <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            This is an earlier submission, kept as it was reviewed.{" "}
            {d.initiation.currentSubmissionId ? <Link className="underline" href={`/ppi/review/${d.initiation.currentSubmissionId}`}>Open the current submission</Link> : null}
          </p>
        ) : null}
        {outcome ? (
          <div role={outcome.tone === "error" ? "alert" : "status"} className={clsx("flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm font-semibold", outcome.tone === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800")}>
            <span>{outcome.text}</span>
            {outcome.stale ? <button className="rounded-full bg-white px-3 py-1 text-xs font-bold ring-1 ring-rose-200" onClick={() => { setOutcome(null); invalidatePpi(ppiKeys.submission(submissionId)); }}>Reload</button> : null}
          </div>
        ) : null}
        {interview.selfCompleted ? (
          <p role="status" className="rounded-2xl bg-violet-50 p-4 text-sm font-semibold text-violet-900">
            Self-completed: the firm entered answers on the web form; the enumerator checked them and submitted. The change history shows who entered what.
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <aside className="self-start rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prism-border/60 xl:sticky xl:top-4">
          <h2 className="text-base font-black text-prism-text">{checklist ? "Review checklist" : "Sections"}</h2>
          {checklist ? (
            <>
              <p className="mt-1 text-sm text-prism-muted">{reviewedCount} of {PAGES.length} pages reviewed</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-violet-100" role="progressbar" aria-label="Pages reviewed" aria-valuemin={0} aria-valuemax={PAGES.length} aria-valuenow={reviewedCount}>
                  <div className="h-full rounded-full bg-prism-purple transition-all" style={{ width: `${(reviewedCount / PAGES.length) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-prism-muted">{Math.round((reviewedCount / PAGES.length) * 100)}%</span>
              </div>
            </>
          ) : null}
          <nav aria-label="Review pages" className="mt-3">
            <ol className="space-y-1">
              {PAGES.map((p, k) => {
                const done = reviewed.includes(p.id);
                const current = k === pageIndex;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => goTo(k)}
                      aria-current={current ? "step" : undefined}
                      className={clsx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left", current ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-prism-bg")}
                    >
                      {checklist ? (
                        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black", done ? "bg-emerald-600 text-white" : current ? "bg-prism-purple text-white" : "text-prism-muted ring-1 ring-prism-border")}>
                          {done ? <CheckIcon /> : k + 1}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className={clsx("block text-sm font-bold", current ? "text-prism-purple" : "text-prism-text")}>{p.title}</span>
                        {checklist ? <span className="block text-xs text-prism-muted">{done ? "Reviewed" : current ? "In progress" : "Not reviewed"}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          {checklist && !complete ? <p className="mt-3 border-t border-prism-border/60 pt-3 text-xs text-prism-muted">Mark each page reviewed to unlock a decision.</p> : null}
          <button type="button" onClick={() => { goTo(PAGES.length - 1); setShowAudit(true); }} className="mt-3 text-sm font-semibold text-prism-purple underline">View change history</button>
        </aside>

        <section aria-labelledby="ppi-page-title" className="min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prism-border/60 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {checklist ? <span className="rounded-lg bg-violet-100 px-2 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-prism-purple">Page {pageIndex + 1} of {PAGES.length}</span> : null}
              <h2 id="ppi-page-title" className="mt-2 text-xl font-black text-prism-text">{page.title}</h2>
            </div>
            {canComment ? (
              <button type="button" onClick={() => { setTargetKey(pageTargets[0]?.key ?? null); setCommentTab("add"); commentBox.current?.focus(); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-prism-purple ring-1 ring-prism-border hover:bg-prism-bg">
                <CommentIcon /> Add comment
              </button>
            ) : null}
          </div>
          {checklist && !complete ? (
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-prism-purple"><LockIcon /><span>Review all {PAGES.length} pages before approving or returning this submission.</span></p>
          ) : null}

          <div className="mt-4">
            {page.id === "ESTABLISHMENT" ? <EstablishmentPage d={d} commentFor={commentFor} targets={targets.ESTABLISHMENT} /> : null}
            {page.id === "REVENUE" ? <RevenuePage d={d} commentFor={commentFor} /> : null}
            {page.id === "PRODUCTS" ? <ProductsPage d={d} commentFor={commentFor} /> : null}
            {page.id === "HISTORY" ? <HistoryPage d={d} submissionId={submissionId} showAudit={showAudit} onToggleAudit={() => setShowAudit((v) => !v)} /> : null}
          </div>

          {checklist && !pageReviewed ? (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-prism-text">
              <InfoIcon /><span>When you finish checking this page, select <strong>{last ? "Mark reviewed & finish" : "Mark reviewed & next"}</strong>.</span>
            </p>
          ) : null}
        </section>

        <aside className="space-y-4 self-start xl:sticky xl:top-4">
          {canComment ? (
            <section aria-labelledby="ppi-comments" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prism-border/60">
              <h2 id="ppi-comments" className="text-base font-black text-prism-text">Review comments</h2>
              <div role="tablist" className="mt-3 flex gap-4 border-b border-prism-border/60 text-sm font-bold">
                <button role="tab" aria-selected={commentTab === "add"} onClick={() => setCommentTab("add")} className={clsx("-mb-px border-b-2 px-1 pb-2", commentTab === "add" ? "border-prism-purple text-prism-purple" : "border-transparent text-prism-muted")}>Add comment</button>
                <button role="tab" aria-selected={commentTab === "all"} onClick={() => setCommentTab("all")} className={clsx("-mb-px border-b-2 px-1 pb-2", commentTab === "all" ? "border-prism-purple text-prism-purple" : "border-transparent text-prism-muted")}>
                  All comments{issues.length ? ` (${issues.length})` : ""}
                </button>
              </div>
              {commentTab === "add" ? (
                <form onSubmit={saveComment} className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold text-prism-muted">Attach to</span>
                    <select value={selected?.key ?? ""} onChange={(e) => setTargetKey(e.target.value)} className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-prism-border">
                      {pageTargets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </label>
                  {selected?.context ? (
                    <div>
                      <p className="text-xs font-bold text-prism-muted">Submitted value</p>
                      <p className="mt-1 whitespace-pre-line rounded-xl bg-prism-bg/80 px-3 py-2 text-sm">{selected.context}</p>
                    </div>
                  ) : null}
                  <label className="block">
                    <span className="sr-only">Comment</span>
                    <textarea ref={commentBox} value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={4} maxLength={1000} placeholder="Describe what needs checking or correcting…" className="w-full rounded-xl p-3 text-sm ring-1 ring-prism-border" />
                  </label>
                  {issues.some((i) => keyOf(i) === selected?.key) ? <p className="text-xs text-prism-muted">Saving replaces your comment on this item.</p> : null}
                  <button disabled={!commentText.trim()} className="rounded-xl bg-prism-purple px-4 py-2 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">Save comment</button>
                </form>
              ) : (
                <div className="mt-3">
                  {issues.length ? (
                    <ul className="space-y-2 text-sm">
                      {issues.map((issue, k) => (
                        <li key={`${keyOf(issue)}-${k}`} className="rounded-xl bg-prism-bg/80 px-3 py-2">
                          <p className="font-bold">{issue.label}</p>
                          <p className="whitespace-pre-line">{issue.comment}</p>
                          <button type="button" onClick={() => setIssues((l) => l.filter((_, i) => i !== k))} className="mt-1 text-xs font-bold text-prism-muted underline" aria-label={`Remove comment on ${issue.label}`}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-prism-muted">No comments yet. Comments go to the enumerator with a return.</p>}
                </div>
              )}
            </section>
          ) : null}

          <section aria-labelledby="ppi-history-card" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-prism-border/60">
            <h2 id="ppi-history-card" className="text-base font-black text-prism-text">Review history</h2>
            {d.reviewEvents.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {d.reviewEvents.slice(-3).map((e) => (
                  <li key={e.reviewEventId}>
                    <span className={clsx("font-bold", e.decision === "APPROVED" ? "text-emerald-700" : "text-rose-700")}>{e.decision === "APPROVED" ? "Approved" : "Returned"}</span>{" "}
                    at {STAGE_LABEL[e.stage]} · submission {e.submissionNo}
                    <span className="block text-xs text-prism-muted">{e.reviewerName}, {formatDateTime(e.reviewedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-prism-muted">No decisions yet.</p>}
            <ul className="mt-3 space-y-1 text-sm">
              {d.submissions.map((s) => (
                <li key={s.submissionId}>
                  <Link className={clsx("text-prism-purple underline", s.submissionId === submissionId && "font-bold")} href={`/ppi/review/${s.submissionId}`}>Submission {s.submissionNo}</Link>
                  {s.submissionId === d.initiation.currentSubmissionId ? <span className="font-bold text-prism-purple"> · Current</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-prism-border/70 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-black text-prism-text">{checklist ? `${reviewedCount} of ${PAGES.length} pages reviewed` : `Page ${pageIndex + 1} of ${PAGES.length}`}</p>
            <div className="text-xs text-prism-muted">
              {d.canDecide && d.decidesAt && d.initiation.reviewStage && d.decidesAt !== d.initiation.reviewStage ? (
                <p className="font-semibold text-amber-800" role="note">
                  Waiting for the {STAGE_LABEL[d.initiation.reviewStage]} review: your decision is recorded as the {STAGE_LABEL[d.decidesAt]}&apos;s, ahead of it.
                </p>
              ) : null}
              {d.canDecide && !complete ? <p className="hidden items-center gap-1 sm:flex"><LockIcon /> Complete all pages to enable a decision.</p> : null}
              {d.canDecide && complete ? <p>{issues.length ? `${issues.length} comment${issues.length === 1 ? "" : "s"} for the enumerator` : "Add comments to return the submission with them."}</p> : null}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => goTo(pageIndex - 1)} disabled={pageIndex === 0} aria-label="Previous page" className="rounded-xl px-3 py-2.5 text-sm font-bold text-prism-purple ring-1 ring-prism-purple disabled:opacity-40 sm:px-4">← <span className="hidden sm:inline">Previous page</span></button>
            {checklist && !pageReviewed ? (
              <button type="button" onClick={markPage} disabled={marking} className="rounded-xl bg-prism-purple px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:px-8">
                {marking ? "Saving…" : last ? "Mark reviewed & finish" : "Mark reviewed & next →"}
              </button>
            ) : (
              <button type="button" onClick={() => goTo(pageIndex + 1)} disabled={last} className="rounded-xl px-4 py-2.5 text-sm font-bold text-prism-purple ring-1 ring-prism-border disabled:opacity-40">Next page →</button>
            )}
            {d.canDecide ? (
              <div className="col-span-2 grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
                <button type="button" onClick={() => setDialog("RETURNED")} disabled={!complete} className="inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:ring-slate-200 sm:px-4">
                  {!complete ? <LockIcon /> : null}<span>Return<span className="hidden sm:inline"> for correction</span></span>
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("APPROVED")}
                  disabled={!complete || issues.length > 0}
                  title={issues.length ? "Remove the comments or return the submission" : undefined}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-prism-purple px-3 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:bg-slate-100 disabled:text-slate-500 sm:px-4"
                >
                  {!complete ? <LockIcon /> : null}<span>{nextStage ? <>Approve<span className="hidden sm:inline"> &amp; send to {nextStage === "RS" ? "RS" : STAGE_LABEL[nextStage]} →</span></> : "Approve (final)"}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {dialog ? <DecisionForm decision={dialog} issues={issues} onRemove={(k) => setIssues((l) => l.filter((_, i) => i !== k))} onClose={() => setDialog(null)} onSubmit={decide} /> : null}
    </article>
  );
}

const keyOf = (i: ReviewIssue) => `${i.entityType}:${i.recordId}:${i.field ?? ""}`;

// Every item a comment can point at, by page; the whole submission first.
function buildTargets(d: SubmissionDetail): Record<PageId, Target[]> {
  const snap = d.submission.snapshot;
  const est = snap.establishment;
  const i = snap.initiation;
  const whole = target("INITIATION", i.initiationId, null, "Whole submission");
  const latestGps = i.gpsChecks[i.gpsChecks.length - 1];
  const currency = currencySymbol(snap.options, i.revenue.currency);
  return {
    ESTABLISHMENT: [
      whole,
      ...COMPARED.map(([key, label]) => target("ESTABLISHMENT", est.establishmentId, key, label, generalValue(est.general, key) || "—")),
      ...(latestGps ? [target("GPS_CHECK", latestGps.id, null, "Location capture", `${formatDecimal(latestGps.distanceM)} m away, accuracy ${latestGps.accuracyM ?? "—"} m`)] : []),
    ],
    REVENUE: [
      whole,
      target("INITIATION", i.initiationId, "revenue.annual", "Annual revenue", `${i.revenue.referencePeriod} · ${amountText(i.revenue.annual, `${currency} `)}`),
      ...i.categories.map((c) => target("CATEGORY", c.id, null, c.name, `CPC ${c.cpcCode ?? "—"}${c.cpcCode && d.cpc?.[c.cpcCode] ? ` · ${d.cpc[c.cpcCode]}` : ""}`)),
      ...i.revenue.quarterly.map((q) => target("QUARTERLY_REVENUE", q.id, null, `Q${q.quarter} ${q.year} revenue`, amountText(q.amount))),
    ],
    PRODUCTS: [
      whole,
      ...i.categories.flatMap((c) => c.products.flatMap((p) => [
        target("PRODUCT", p.id, null, p.name, `${c.name} · CPC ${p.cpcCode ?? "—"}`),
        ...(p.seasonality ? [target("SEASONALITY", p.id, null, `${p.name}: seasonality`)] : []),
        ...p.specifications.flatMap((s, n) => [
          target("SPECIFICATION", s.id, null, `${p.name}: specification ${n + 1}`, s.details.description || "—"),
          ...s.prices.map((pr) => target("PRICE", pr.id, "amount",
            `${p.name}: ${pr.kind === "CURRENT" ? "current" : ""} ${(SERIES_LABEL[pr.series] ?? pr.series).toLowerCase()}${pr.kind === "HISTORY" ? `, ${monthLabel(pr.month)}` : ""}`.replace(/\s+/g, " "),
            `${amountText(pr.amount)} · ${monthName(pr.month)}`)),
        ]),
      ])),
    ],
    HISTORY: [whole],
  };
}

function generalValue(general: Record<string, string | null>, key: string) {
  const value = general[key];
  return key === "questionnaireType" ? QUESTIONNAIRE_LABEL[value ?? ""] ?? value : value;
}

function Stepper({ stages, workflowStatus, reviewStage }: { stages: string[]; workflowStatus: string; reviewStage: string | null }) {
  const steps = [{ key: "SUBMITTED", label: "Submitted" }, ...stages.map((s) => ({ key: s, label: s === "SUPERVISOR" ? "Supervisor review" : STAGE_LABEL[s] ?? s }))];
  const current = workflowStatus === "SUBMITTED" && reviewStage ? stages.indexOf(reviewStage) + 1 : -1;
  const doneUpTo = workflowStatus === "APPROVED" ? steps.length : current > 0 ? current : 1;
  return (
    <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-prism-border/60 pt-4" aria-label="Review stages">
      {steps.map((step, k) => {
        const isCurrent = k === current;
        const done = k < doneUpTo && !isCurrent;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
            <span className={clsx("h-5 w-5 shrink-0 rounded-full", isCurrent ? "bg-prism-purple" : done ? "bg-prism-purple/80 ring-2 ring-violet-200" : "ring-2 ring-slate-300")} aria-hidden />
            <span className={clsx("whitespace-nowrap text-sm", isCurrent ? "rounded-lg bg-prism-purple px-3 py-1 font-bold text-white" : "text-prism-muted")}>{step.label}</span>
            {k < steps.length - 1 ? <span className={clsx("hidden h-0.5 flex-1 sm:block", k < current || workflowStatus === "APPROVED" ? "bg-prism-purple" : "bg-slate-200")} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function EstablishmentPage({ d, commentFor, targets }: { d: SubmissionDetail; commentFor: CommentFor; targets: Target[] }) {
  const [changedOnly, setChangedOnly] = useState(true);
  const [showCaptures, setShowCaptures] = useState(false);
  const snap = d.submission.snapshot;
  const est = snap.establishment;
  const interview = snap.initiation;
  const rows = COMPARED.filter(([key]) => d.submission.preload[key] !== undefined || est.general[key] != null).map(([key, label]) => {
    const original = d.submission.preload[key];
    const submitted = est.general[key];
    const changed = original !== undefined && String(original ?? "") !== String(submitted ?? "");
    const shown = (value: unknown) => (key === "questionnaireType" ? QUESTIONNAIRE_LABEL[String(value ?? "")] ?? value : value);
    return { key, label, original: original === undefined ? undefined : shown(original), submitted: shown(submitted), changed };
  });
  const changedCount = rows.filter((r) => r.changed).length;
  const visible = changedOnly && changedCount ? rows.filter((r) => r.changed) : rows;
  const byKey = (key: string) => targets.find((t) => t.entityType === "ESTABLISHMENT" && t.field === key)!;
  const gps = interview.gpsChecks;
  const latest = gps[gps.length - 1];
  const verdict = snap.gpsVerdict?.verified
    ? { ok: true, text: "GPS verified" }
    : snap.gpsVerdict?.accuracyOk && snap.gpsVerdict.distanceOk === false && interview.establishmentInfo.gpsDistanceReason
      ? { ok: false, text: "Captured more than 20 m away (reason given)" }
      : interview.selfCompleted && !gps.length
        ? { ok: false, text: "Not verified: completed by the firm on the web form" }
        : { ok: false, text: "GPS not verified" };
  return (
    <div className="space-y-4">
      <p className="text-sm text-prism-muted">Compare changes, then review the submitted details.</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-prism-purple,#5b21b6)]" />
          Show changed fields only
        </label>
        <span className="text-prism-muted">{changedCount} changed field{changedCount === 1 ? "" : "s"}</span>
      </div>
      <div>
        <p className="mb-2 text-sm text-prism-muted">Compared with the preloaded assignment{changedOnly && !changedCount ? ": nothing changed, all fields shown" : ""}</p>
        <div className="overflow-x-auto rounded-2xl ring-1 ring-prism-border/60">
          <table className="w-full text-sm">
            <thead className="bg-prism-bg/70 text-left text-xs font-bold text-prism-muted">
              <tr><th scope="col" className="px-3 py-2">Field</th><th scope="col" className="px-3 py-2">Preloaded value</th><th scope="col" className="px-3 py-2">Submitted value</th><th scope="col" className="w-10"><span className="sr-only">Comment</span></th></tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.key} className={clsx("border-t border-prism-border/50", r.changed && "bg-amber-50/70")}>
                  <th scope="row" className="px-3 py-2 text-left font-bold">{r.label}</th>
                  <td className="px-3 py-2">{r.original === undefined || r.original === null || r.original === "" ? <span className="italic text-prism-muted">Not provided</span> : String(r.original)}</td>
                  <td className="px-3 py-2">
                    {r.submitted ? String(r.submitted) : <span className="italic text-prism-muted">Not provided</span>}
                    {r.changed ? <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">Changed</span> : null}
                  </td>
                  <td className="pr-2 text-right">{commentFor(byKey(r.key))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl p-4 ring-1 ring-prism-border/60">
        <h3 className="text-base font-black">Submitted location</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Region" value={est.general.regionName || "—"} />
          <Fact label="District" value={est.general.districtName || "—"} />
          <Fact label="Town / locality" value={est.general.townLocality || "—"} />
          <Fact label="Suburb" value={est.general.suburb || "—"} />
          <div className="sm:col-span-2"><Fact label="Exact location" value={est.general.locationDescription || "—"} /></div>
          {interview.questionnaireType === "AGRICULTURE"
            ? <Fact label="Type of agricultural activity" value={codedText(snap.options, "farmType", { code: interview.establishmentInfo.farmType, otherText: "" })} />
            : <Fact label="GhanaPost GPS" value={interview.establishmentInfo.ghanaPostGps ?? "—"} />}
          {interview.questionnaireType === "OTHER" ? <Fact label="Sector" value={interview.establishmentInfo.sector ?? "—"} /> : null}
        </dl>
      </div>

      <div className={clsx("rounded-2xl p-4", verdict.ok ? "bg-emerald-50" : "bg-amber-50")}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className={clsx("flex items-center gap-2 text-base font-black", verdict.ok ? "text-emerald-800" : "text-amber-900")}>
            <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-white", verdict.ok ? "bg-emerald-600" : "bg-amber-500")}>{verdict.ok ? <CheckIcon /> : "!"}</span>
            {verdict.text}
          </p>
          {latest ? (
            <>
              <Fact label="Accuracy" value={latest.accuracyM != null ? `${latest.accuracyM} m` : "—"} />
              <Fact label="Distance" value={latest.distanceM != null ? `${formatDecimal(latest.distanceM)} m` : "—"} />
              <div className="text-xs text-prism-muted">
                Captured {formatDateTime(latest.capturedAt)} · {gps.length} capture{gps.length === 1 ? "" : "s"}
                <button type="button" onClick={() => setShowCaptures((v) => !v)} className="block font-semibold text-prism-purple underline">{showCaptures ? "Hide capture details" : "View capture details"}</button>
              </div>
              <div className="ml-auto">{commentFor(targets.find((t) => t.entityType === "GPS_CHECK")!)}</div>
            </>
          ) : null}
        </div>
        {snap.gpsVerdict?.distanceOk === false && interview.establishmentInfo.gpsDistanceReason ? (
          <p className="mt-3 whitespace-pre-line text-sm text-amber-950"><span className="font-bold">Enumerator&apos;s reason for the distance: </span>{interview.establishmentInfo.gpsDistanceReason}</p>
        ) : null}
        {showCaptures ? (
          <table className="mt-3 w-full text-xs">
            <caption className="sr-only">Location captures</caption>
            <thead className="text-left text-prism-muted"><tr><th scope="col" className="py-1">Captured</th><th scope="col">Distance (server)</th><th scope="col">Distance (phone)</th><th scope="col">Accuracy</th></tr></thead>
            <tbody>
              {[...gps].reverse().map((g) => (
                <tr key={g.id} className="border-t border-black/5">
                  <td className="py-1">{formatDateTime(g.capturedAt)}</td>
                  <td>{g.distanceM != null ? `${formatDecimal(g.distanceM)} m` : "—"}</td>
                  <td>{g.clientDistanceM != null ? `${g.clientDistanceM} m` : "—"}</td>
                  <td>{g.accuracyM != null ? `${g.accuracyM} m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <details className="rounded-2xl p-4 ring-1 ring-prism-border/60">
        <summary className="cursor-pointer list-none">
          <span className="block text-base font-black">Additional details</span>
          <span className="block text-sm text-prism-muted">TIN, email addresses and website</span>
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="TIN" value={est.general.tin || "—"} />
          <Fact label="Website" value={est.general.website || "—"} />
          <Fact label="Contact email" value={est.general.contactPersonEmail || "—"} />
          <Fact label="Establishment email" value={est.general.establishmentEmail || "—"} />
        </dl>
      </details>
    </div>
  );
}

function RevenuePage({ d, commentFor }: { d: SubmissionDetail; commentFor: CommentFor }) {
  const snap = d.submission.snapshot;
  const interview = snap.initiation;
  const currency = currencySymbol(snap.options, interview.revenue.currency);
  const matches = snap.revenueCheck.status === "MATCH";
  const years = [...new Set(interview.revenue.quarterly.map((q) => q.year))].sort();
  const partialYears: number[] = [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-prism-muted">Annual revenue · {interview.revenue.referencePeriod}</p>
          <p className="text-2xl font-black text-prism-text">{amountText(interview.revenue.annual, `${currency} `)}</p>
        </div>
        <span className="hidden h-10 w-px bg-prism-border sm:block" aria-hidden />
        <p className={clsx("flex items-center gap-2 font-bold", matches ? "text-emerald-800" : "text-amber-900")}>
          <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-white", matches ? "bg-emerald-600" : "bg-amber-500")}>{matches ? <CheckIcon /> : "!"}</span>
          {matches ? "Category total matches" : `Category total: ${snap.revenueCheck.status.toLowerCase().replace(/_/g, " ")}${snap.revenueCheck.difference ? ` (difference ${formatDecimal(snap.revenueCheck.difference)})` : ""}`}
        </p>
        <div className="ml-auto">{commentFor(target("INITIATION", interview.initiationId, "revenue.annual", "Annual revenue"))}</div>
      </div>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-prism-border/60">
        <table className="w-full text-sm">
          <caption className="sr-only">Major product categories</caption>
          <thead className="bg-prism-bg/70 text-left text-xs font-bold text-prism-muted">
            <tr><th scope="col" className="px-3 py-2">Major category</th><th scope="col" className="px-3 py-2">CPC</th><th scope="col" className="px-3 py-2">Revenue share</th><th scope="col" className="px-3 py-2">Products</th><th scope="col" className="w-10"><span className="sr-only">Comment</span></th></tr>
          </thead>
          <tbody>
            {interview.categories.map((c) => (
              <tr key={c.id} className="border-t border-prism-border/50 align-top">
                <th scope="row" className="px-3 py-2 text-left font-bold">{c.name}</th>
                <td className="max-w-xs px-3 py-2"><CpcText code={c.cpcCode} cpc={d.cpc} /></td>
                <td className="px-3 py-2">{c.revenueBasis === "PERCENT" ? `${amountText(c.revenuePercent)}%` : amountText(c.revenueValue, `${currency} `)}</td>
                <td className="px-3 py-2">{c.products.length} of {c.productCount ?? "?"}</td>
                <td className="pr-2 text-right">{commentFor(target("CATEGORY", c.id, null, c.name))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {years.length ? (
        <div>
          <h3 className="text-base font-black">Quarterly revenue ({currency})</h3>
          <div className="mt-2 overflow-x-auto rounded-2xl ring-1 ring-prism-border/60">
            <table className="w-full text-sm">
              <caption className="sr-only">Quarterly revenue</caption>
              <thead className="bg-prism-bg/70 text-left text-xs font-bold text-prism-muted">
                <tr><th scope="col" className="px-3 py-2">Year</th>{[1, 2, 3, 4].map((n) => <th key={n} scope="col" className="px-3 py-2">Q{n}</th>)}<th scope="col" className="px-3 py-2">Period total</th></tr>
              </thead>
              <tbody>
                {years.map((year) => {
                  const quarters = [1, 2, 3, 4].map((n) => interview.revenue.quarterly.find((q) => q.year === year && q.quarter === n));
                  const reported = quarters.filter((q): q is NonNullable<typeof q> => q?.amount.state === "REPORTED" && q.amount.amount != null);
                  if (reported.length < 4) partialYears.push(year);
                  return (
                    <tr key={year} className="border-t border-prism-border/50">
                      <th scope="row" className="px-3 py-2 text-left font-black">{year}</th>
                      {quarters.map((q, n) => (
                        <td key={n} className="group px-3 py-2">
                          {q ? <span className={clsx(q.amount.state !== "REPORTED" && "text-prism-muted")}>{amountText(q.amount)}</span> : <span className="text-prism-muted">—</span>}
                          {q ? <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">{commentFor(target("QUARTERLY_REVENUE", q.id, null, `Q${q.quarter} ${q.year} revenue`))}</span> : null}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <span className="font-black">{reported.length ? formatDecimal(sumDecimals(reported.map((q) => q.amount.amount!))) : "—"}</span>
                        {reported.length && reported.length < 4 ? <span className="block text-xs text-prism-muted">{quarterRange(reported.map((q) => q.quarter))} only</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {partialYears.length ? <p className="mt-2 text-sm text-prism-muted">{partialYears.join(" and ")} cover{partialYears.length === 1 ? "s" : ""} reported quarters only.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ProductsPage({ d, commentFor }: { d: SubmissionDetail; commentFor: CommentFor }) {
  const interview = d.submission.snapshot.initiation;
  const products = interview.categories.flatMap((c) => c.products.map((p) => ({ c, p })));
  if (!products.length) return <p className="text-sm text-prism-muted">No products were recorded.</p>;
  return (
    <div className="space-y-6">
      {products.map(({ c, p }) => <ProductView key={p.id} category={c} product={p} d={d} commentFor={commentFor} />)}
    </div>
  );
}

function ProductView({ category, product: p, d, commentFor }: { category: Category; product: Product; d: SubmissionDetail; commentFor: CommentFor }) {
  const snap = d.submission.snapshot;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-prism-text">{p.name}</h3>
          <p className="text-sm text-prism-muted">{category.name} · CPC <CpcText code={p.cpcCode} cpc={d.cpc} inline /></p>
        </div>
        {commentFor(target("PRODUCT", p.id, null, p.name))}
      </div>
      {p.seasonality ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-prism-muted">
          <span>
            Seasonality: {p.seasonality.producedAllYear ? "produced all year" : `available ${p.seasonality.availableMonths.map((m) => MONTHS[m - 1]).join(", ") || "—"}`};
            high {p.seasonality.highProductionMonths.map((m) => MONTHS[m - 1]).join(", ") || "—"}; low {p.seasonality.lowProductionMonths.map((m) => MONTHS[m - 1]).join(", ") || "—"};
            main buyer {codedText(snap.options, "mainBuyer", p.seasonality.mainBuyer)}.
          </span>
          {commentFor(target("SEASONALITY", p.id, null, `${p.name}: seasonality`))}
        </p>
      ) : null}
      <div className="mt-3 space-y-4">
        {p.specifications.map((s, n) => <SpecificationView key={s.id} spec={s} n={n + 1} productName={p.name} snap={snap} places={d.places} commentFor={commentFor} />)}
      </div>
    </div>
  );
}

// A construction count, its "not applicable (none)" answer, or unanswered.
function countText(value: unknown, notApplicable: unknown) {
  if (notApplicable === true) return "N/A (none)";
  return value == null || value === "" ? "—" : String(value);
}

function SpecificationView({ spec, n, productName, snap, places, commentFor }: {
  spec: Specification; n: number; productName: string; snap: Snapshot; places?: SubmissionDetail["places"]; commentFor: CommentFor;
}) {
  const qt = snap.initiation.questionnaireType;
  const t = spec.terms;
  // A place id the snapshot names but the server could not name.
  const placeName = (names: Record<string, string> | undefined, id: string | null | undefined, unknown: string) => (id ? names?.[id] ?? unknown : null);
  const contractPlace = [placeName(places?.districts, t.contractDistrictId, "Unknown district"), placeName(places?.regions, t.contractRegionId, "Unknown region")]
    .filter(Boolean).join(", ") || "—";
  const facts: [string, string][] = qt === "CONSTRUCTION"
    ? [["Material", t.materialType ?? "—"], ["Customer", t.contractCustomer ?? "—"], ["Contract location", contractPlace], ["Bridges", countText(t.bridges, t.bridgesNotApplicable)], ["Culverts", countText(t.culverts, t.culvertsNotApplicable)], ["Soil", t.soilType ?? "—"], ["Other details", t.contractSpecification || "—"]]
    : [
      ["Unit", codedText(snap.options, "unit", spec.details.unit)],
      ...(qt === "WHOLESALE_RETAIL" ? [["Size of transaction", t.transactionSizeText ?? "—"] as [string, string]] : []),
      ...(qt === "AGRICULTURE" ? [["Packaging", codedText(snap.options, "packaging", t.packaging)] as [string, string], ["Quantity sold", formatDecimal(t.quantitySold)] as [string, string], ["Frequency", codedText(snap.options, "saleFrequency", t.saleFrequency)] as [string, string]] : []),
      ["Customer", codedText(snap.options, "customerMarket", t.customerMarket)],
      ["Discount", codedText(snap.options, "discount", t.discount)],
      ["Payment", codedText(snap.options, "paymentTerms", t.paymentTerms)],
    ];
  const series = [...new Set(spec.prices.map((p) => p.series))];
  const months = [...new Set(spec.prices.filter((p) => p.kind === "HISTORY").map((p) => p.month))].sort();
  const currents = series.map((s) => spec.prices.find((p) => p.series === s && p.kind === "CURRENT")).filter((p): p is NonNullable<typeof p> => !!p);
  const priceLabel = (series: string, kind: string, month: string) =>
    `${productName}: ${kind === "CURRENT" ? "current " : ""}${(SERIES_LABEL[series] ?? series).toLowerCase()}${kind === "HISTORY" ? `, ${monthLabel(month)}` : ""}`;
  const historyYears = [...new Set(months.map((m) => m.slice(0, 4)))].join("–");
  return (
    <div className="rounded-2xl p-4 ring-1 ring-prism-border/60">
      <div className="flex items-start justify-between gap-3 border-b border-prism-border/50 pb-3">
        <p className="text-sm"><span className="font-black text-prism-purple">Specification {n}</span><span className="mx-2 text-prism-border">|</span>{spec.details.description || "—"}</p>
        {commentFor(target("SPECIFICATION", spec.id, null, `${productName}: specification ${n}`))}
      </div>
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <dl className="divide-y divide-prism-border/50 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2">
                <dt className="font-semibold text-prism-muted">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
          {currents.map((p) => (
            <div key={p.id} className="rounded-2xl bg-violet-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-prism-purple">Current {(SERIES_LABEL[p.series] ?? p.series).toLowerCase()}</p>
                {commentFor(target("PRICE", p.id, "amount", priceLabel(p.series, "CURRENT", p.month)))}
              </div>
              <p className="text-2xl font-black text-prism-text">{amountText(p.amount, `${currencySymbol(snap.options, p.currency)} `)}</p>
              <p className="text-sm text-prism-muted">{monthName(p.month)}</p>
              {p.reason ? <p className="mt-1 whitespace-pre-line text-xs text-amber-900">Reason: {p.reason}</p> : null}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">Price history{historyYears ? ` · ${historyYears}` : ""}</p>
          {months.length ? (
            <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-prism-border/60">
              <table className="w-full text-sm">
                <caption className="sr-only">Price history of specification {n}</caption>
                <thead className="bg-prism-bg/70 text-left text-xs font-bold text-prism-muted">
                  <tr><th scope="col" className="px-3 py-1.5">Month</th>{series.map((s) => <th key={s} scope="col" className="px-3 py-1.5 text-right">{SERIES_LABEL[s] ?? s}</th>)}</tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m} className="border-t border-prism-border/40">
                      <th scope="row" className="px-3 py-1 text-left font-normal">{monthName(m)}</th>
                      {series.map((s) => {
                        const h = spec.prices.find((p) => p.series === s && p.kind === "HISTORY" && p.month === m);
                        return (
                          <td key={s} className="group px-3 py-1 text-right">
                            <span className="inline-flex items-center justify-end gap-1">
                              <span className={clsx(h?.amount.state !== "REPORTED" && "text-prism-muted")}>{h ? amountText(h.amount) : "—"}</span>
                              {h ? <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">{commentFor(target("PRICE", h.id, "amount", priceLabel(s, "HISTORY", m)))}</span> : null}
                            </span>
                            {h?.reason ? <span className="block whitespace-pre-line text-left text-[11px] text-amber-900">Reason: {h.reason}</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-sm text-prism-muted">No price history recorded.</p>}
        </div>
      </div>
    </div>
  );
}

function HistoryPage({ d, submissionId, showAudit, onToggleAudit }: { d: SubmissionDetail; submissionId: string; showAudit: boolean; onToggleAudit: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-black">Decisions</h3>
        {d.reviewEvents.length ? (
          <ol className="mt-2 space-y-3">
            {d.reviewEvents.map((e) => (
              <li key={e.reviewEventId} className="rounded-2xl bg-prism-bg/70 p-3 text-sm">
                <p className="font-bold">
                  {e.decision === "APPROVED" ? "Approved" : "Returned"} at {STAGE_LABEL[e.stage]} review
                  {aheadOf(e.stage, e.statusBefore) ? ` (ahead of the ${STAGE_LABEL[aheadOf(e.stage, e.statusBefore)!]} review)` : ""} · submission {e.submissionNo}
                </p>
                <p className="text-xs text-prism-muted">{e.reviewerName}, {formatDateTime(e.reviewedAt)}</p>
                {e.reason ? <p className="mt-1 whitespace-pre-line">{e.reason}</p> : null}
                {e.comment ? <p className="mt-1 whitespace-pre-line text-prism-muted">{e.comment}</p> : null}
                {e.issues.length ? <ul className="mt-1 list-disc pl-5 text-xs">{e.issues.map((i, k) => <li key={k}>{i.comment}</li>)}</ul> : null}
              </li>
            ))}
          </ol>
        ) : <p className="mt-1 text-sm text-prism-muted">No decisions yet.</p>}
      </div>
      <div>
        <h3 className="text-base font-black">Submissions</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {d.submissions.map((s) => (
            <li key={s.submissionId}>
              <Link className={clsx("text-prism-purple underline", s.submissionId === submissionId && "font-bold")} href={`/ppi/review/${s.submissionId}`}>Submission {s.submissionNo}</Link>
              <span className="text-prism-muted"> · {s.submittedByName}, {formatDateTime(s.submittedAt)}</span>
              {s.submissionId === d.initiation.currentSubmissionId ? <span className="font-bold text-prism-purple"> · Current</span> : null}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <button className="rounded-xl px-3 py-2 text-sm font-bold text-prism-purple ring-1 ring-prism-border hover:bg-prism-bg" onClick={onToggleAudit}>
          {showAudit ? "Hide change history" : "Show change history"}
        </button>
        {showAudit ? <AuditPanel initiationId={d.initiation.initiationId} /> : null}
      </div>
    </div>
  );
}

// "011 · Cereals"; the code alone from a server that sends no descriptions.
function CpcText({ code, cpc, inline = false }: { code: string | null | undefined; cpc: Record<string, string> | undefined; inline?: boolean }) {
  if (!code) return <span>—</span>;
  const description = cpc ? cpc[code] ?? "not in the CPC list" : null;
  if (inline) return <span><span className="font-mono font-bold text-prism-text">{code}</span>{description ? ` · ${description}` : ""}</span>;
  return (
    <span>
      <span className="font-mono font-bold">{code}</span>
      {description ? <span className="block text-xs text-prism-muted">{description}</span> : null}
    </span>
  );
}

// "GH¢" from "Ghana cedi (GH¢)"; the label itself when it has no symbol.
function currencySymbol(options: Snapshot["options"], value: Parameters<typeof codedText>[2]) {
  const label = codedText(options, "currency", value);
  return /\(([^)]+)\)\s*$/.exec(label)?.[1] ?? label;
}

// Sum of decimal strings, exactly (as integers at the widest scale).
function sumDecimals(values: string[]) {
  const scale = Math.max(0, ...values.map((v) => (v.split(".")[1] ?? "").length));
  let total = 0;
  for (const v of values) {
    const negative = v.startsWith("-");
    const [whole, fraction = ""] = v.replace("-", "").split(".");
    const n = Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, "0") || "0");
    total += negative ? -n : n;
  }
  const negative = total < 0;
  const digits = String(Math.abs(total)).padStart(scale + 1, "0");
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return `${negative ? "-" : ""}${text}`;
}

// "Q1–Q3" for consecutive quarters, else "Q1, Q3".
function quarterRange(quarters: number[]) {
  const sorted = [...quarters].sort();
  const consecutive = sorted.every((q, k) => k === 0 || q === sorted[k - 1] + 1);
  return consecutive && sorted.length > 1 ? `Q${sorted[0]}–Q${sorted[sorted.length - 1]}` : sorted.map((q) => `Q${q}`).join(", ");
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <dt className="text-xs font-bold text-prism-muted">{label}</dt>
      <dd className={clsx("text-sm", tone === "ok" && "font-bold text-emerald-700", tone === "warn" && "font-bold text-amber-800", !tone && "font-semibold text-prism-text")}>{value}</dd>
    </div>
  );
}

function CommentIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
function CheckIcon() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>;
}
function LockIcon() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
}
function InfoIcon() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-prism-purple" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}

function DecisionForm({ decision, issues, onRemove, onClose, onSubmit }: {
  decision: "APPROVED" | "RETURNED";
  issues: Draft[];
  onRemove: (index: number) => void;
  onClose: () => void;
  onSubmit: (decision: "APPROVED" | "RETURNED", reason: string, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const returning = decision === "RETURNED";
  const tooShort = returning && reason.replace(/\s/g, "").length < 5;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    await onSubmit(decision, reason.trim(), note.trim());
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="ppi-decision" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <h2 id="ppi-decision" className="text-lg font-black">{returning ? "Return for correction" : "Approve"}</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {returning ? (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">Reason (required, at least 5 characters)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl p-3 text-sm ring-1 ring-prism-border" />
            </label>
          ) : null}
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">Note (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-2xl p-3 text-sm ring-1 ring-prism-border" />
          </label>
          {returning && issues.length ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">Comments on records</p>
              <ul className="mt-1 space-y-1 text-sm">
                {issues.map((issue, k) => (
                  <li key={`${issue.recordId}-${k}`} className="flex items-start justify-between gap-2 rounded-xl bg-prism-bg/70 px-3 py-2">
                    <span><strong>{issue.label}:</strong> {issue.comment}</span>
                    <button type="button" onClick={() => onRemove(k)} className="text-xs font-bold text-prism-muted" aria-label={`Remove comment on ${issue.label}`}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-sm font-bold text-prism-muted">Cancel</button>
            <button disabled={tooShort || busy} className={clsx("rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40", returning ? "bg-rose-600" : "bg-prism-purple")}>
              {busy ? "Saving…" : returning ? "Return" : "Approve"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// Change history, newest first. "Older changes" adds the next page below
// the ones already shown.
function AuditPanel({ initiationId }: { initiationId: string }) {
  const [pages, setPages] = useState<(string | null)[]>([null]);
  return (
    <div className="mt-3 space-y-2">
      {pages.map((before, k) => (
        <AuditPage
          key={before ?? "first"}
          initiationId={initiationId}
          before={before}
          onOlder={k === pages.length - 1 ? (next) => setPages((list) => [...list, next]) : undefined}
        />
      ))}
    </div>
  );
}

function AuditPage({ initiationId, before, onOlder }: { initiationId: string; before: string | null; onOlder?: (next: string) => void }) {
  const path = `/initiations/${initiationId}/audit?limit=50${before ? `&before=${before}` : ""}`;
  const audit = usePpiQuery<{ changes: AuditChange[]; nextBefore: string | null }>(ppiKeys.audit(initiationId, before ?? "first"), path);
  if (audit.error) return <p role="alert" className="text-sm text-rose-800">{audit.error}</p>;
  if (!audit.data) return <p className="text-sm text-prism-muted">Loading…</p>;
  const next = audit.data.nextBefore;
  return (
    <>
      <ol className="space-y-2 text-xs">
        {audit.data.changes.map((c) => (
          <li key={c.changeId} className="rounded-xl bg-prism-bg/70 p-3">
            <p className="font-bold">{c.entityType.toLowerCase().replace("_", " ")} {c.operation.toLowerCase()} · {c.source === "FIRM" ? "entered by the firm (web form)" : c.actorName} · {formatDateTime(c.loggedAt)}</p>
            <ul className="mt-1">
              {Object.entries(c.changes).map(([field, v]) => (
                <li key={field}><span className="text-prism-muted">{field}:</span> {String(v.oldDisplay ?? v.old ?? "—")} → {String(v.newDisplay ?? v.new ?? "—")}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {next && onOlder ? <button onClick={() => onOlder(next)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold ring-1 ring-prism-border/70">Older changes</button> : null}
    </>
  );
}

