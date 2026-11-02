"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useState } from "react";
import clsx from "clsx";
import {
  amountText, codedText, formatDateTime, formatDecimal, PpiApiError, ppiApi, ppiKeys, QUESTIONNAIRE_LABEL, STAGE_LABEL,
  type AuditChange, type ReviewIssue, type Snapshot, type Specification, type SubmissionDetail,
} from "./api";
import { invalidatePpi, usePpiQuery } from "./usePpiQuery";

const GENERAL_LABELS: [string, string][] = [
  ["establishmentName", "Name"], ["questionnaireType", "Questionnaire"], ["regionName", "Region"], ["districtName", "District"],
  ["townLocality", "Town / locality"], ["suburb", "Suburb"], ["locationDescription", "Exact location"], ["tin", "TIN"],
  ["contactPersonName", "Contact person"], ["contactPersonPhone", "Contact telephone"], ["contactPersonEmail", "Contact email"],
  ["establishmentPhone", "Establishment telephone"], ["establishmentEmail", "Establishment email"], ["website", "Website"],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const SERIES_LABEL: Record<string, string> = { SELLING: "Selling price", PURCHASE: "Purchase price", CONTRACT: "Contract price" };

type Draft = ReviewIssue & { label: string };

export function SubmissionReview({ submissionId }: { submissionId: string }) {
  const detail = usePpiQuery<SubmissionDetail>(ppiKeys.submission(submissionId), `/submissions/${submissionId}`);
  const [issues, setIssues] = useState<Draft[]>([]);
  const [dialog, setDialog] = useState<"APPROVED" | "RETURNED" | null>(null);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "error"; text: string; stale?: boolean } | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  if (detail.error && !detail.data) return <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{detail.error}</p>;
  if (!detail.data) return <p className="text-sm text-prism-muted">Loading…</p>;
  const d = detail.data;
  const snap = d.submission.snapshot;
  const est = snap.establishment;
  const interview = snap.initiation;
  const canComment = d.canDecide;

  const addIssue = (issue: Draft) => setIssues((list) => (list.some((i) => i.recordId === issue.recordId && i.field === issue.field) ? list : [...list, issue]));
  const comment = (entityType: string, recordId: string, label: string, field: string | null = null, subtle = false) =>
    canComment ? <CommentButton label={label} subtle={subtle} onAdd={(text) => addIssue({ entityType, recordId, field, comment: text, label })} /> : null;

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
      setOutcome({
        tone: "error",
        stale,
        text: stale
          ? `${e.message} Nothing was recorded. Reload to see the current state.`
          : e.errors?.length ? `${e.message} ${e.errors.map((x) => x.message).join(" ")}` : e.message,
      });
    }
  };

  return (
    <article className="space-y-5 pb-28">
      <Link href="/ppi/review" className="text-xs font-bold text-prism-purple">← Review queue</Link>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prism-border/60">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-prism-purple">
          {QUESTIONNAIRE_LABEL[interview.questionnaireType]} · submission {d.submission.submissionNo}
        </p>
        <h1 className="mt-1 text-2xl font-black text-prism-text">{est.general.establishmentName}</h1>
        <p className="mt-1 text-sm text-prism-muted">
          {est.establishmentCode} · submitted by {d.submission.submittedByName} on {formatDateTime(d.submission.submittedAt)} · now{" "}
          <strong>{d.initiation.workflowStatus === "SUBMITTED" ? `at ${STAGE_LABEL[d.initiation.reviewStage ?? ""]} review` : d.initiation.workflowStatus.toLowerCase()}</strong>
        </p>
      </header>

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

      <Section title="General information" note="Preloaded and corrected during the interview; the preload is shown where it differs.">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {GENERAL_LABELS.map(([key, label]) => {
            const value = key === "questionnaireType" ? QUESTIONNAIRE_LABEL[est.general[key] ?? ""] ?? est.general[key] : est.general[key];
            const preloadKey = key === "regionName" ? "regionId" : key === "districtName" ? "districtId" : key;
            const original = d.submission.preload[preloadKey];
            const changed = original !== undefined && key !== "regionName" && key !== "districtName" && String(original ?? "") !== String(est.general[key] ?? "");
            return (
              <div key={key}>
                <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-prism-muted">{label}</dt>
                <dd className="text-sm text-prism-text">
                  {value || "—"}
                  {changed ? <span className="ml-2 rounded bg-amber-100 px-1.5 text-[11px] font-bold text-amber-900">preload: {String(original ?? "—")}</span> : null}
                  {comment("ESTABLISHMENT", est.establishmentId, label, key)}
                </dd>
              </div>
            );
          })}
        </dl>
      </Section>

      <Section title="Establishment information and location">
        <dl className="grid gap-3 sm:grid-cols-3">
          {interview.questionnaireType === "AGRICULTURE"
            ? <Fact label="Type of agricultural activity" value={codedText(snap.options, "farmType", { code: interview.establishmentInfo.farmType, otherText: "" })} />
            : <Fact label="GhanaPost GPS" value={interview.establishmentInfo.ghanaPostGps ?? "—"} />}
          {interview.questionnaireType === "OTHER" ? <Fact label="Sector" value={interview.establishmentInfo.sector ?? "—"} /> : null}
          <Fact
            label="Location check"
            value={snap.gpsVerdict?.verified
              ? "Verified (accuracy below 5 m, within 20 m)"
              : snap.gpsVerdict?.accuracyOk && snap.gpsVerdict.distanceOk === false && interview.establishmentInfo.gpsDistanceReason
                ? "Captured more than 20 m from the firm (reason given)"
                : "Not verified"}
            tone={snap.gpsVerdict?.verified ? "ok" : "warn"}
          />
        </dl>
        {snap.gpsVerdict?.distanceOk === false && interview.establishmentInfo.gpsDistanceReason ? (
          <p className="mt-3 whitespace-pre-line rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
            <span className="font-bold">Enumerator&apos;s reason for the distance: </span>{interview.establishmentInfo.gpsDistanceReason}
          </p>
        ) : null}
        {interview.gpsChecks.length ? (
          <p className="mt-3 text-xs text-prism-muted">
            Latest capture {formatDateTime(interview.gpsChecks[interview.gpsChecks.length - 1].capturedAt)}: server-measured distance{" "}
            {formatDecimal(interview.gpsChecks[interview.gpsChecks.length - 1].distanceM)} m, accuracy {interview.gpsChecks[interview.gpsChecks.length - 1].accuracyM ?? "—"} m
            {" "}({interview.gpsChecks.length} capture{interview.gpsChecks.length === 1 ? "" : "s"}).
            {comment("GPS_CHECK", interview.gpsChecks[interview.gpsChecks.length - 1].id, "Location capture")}
          </p>
        ) : null}
      </Section>

      <Section title="Revenue and major product categories">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label={`Total revenue ${interview.revenue.referencePeriod}`} value={amountText(interview.revenue.annual, `${codedText(snap.options, "currency", interview.revenue.currency)} `)} />
          <Fact label="Check against categories" value={snap.revenueCheck.status === "MATCH" ? "Matches" : snap.revenueCheck.status} tone={snap.revenueCheck.status === "MATCH" ? "ok" : "warn"} />
          <div>{comment("INITIATION", interview.initiationId, "Total revenue", "revenue.annual")}</div>
        </dl>
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Major product categories</caption>
          <thead className="text-left text-[10px] font-black uppercase tracking-[0.12em] text-prism-muted">
            <tr><th scope="col" className="py-2">Category</th><th scope="col">CPC</th><th scope="col">Revenue</th><th scope="col">Products</th><th scope="col"><span className="sr-only">Comment</span></th></tr>
          </thead>
          <tbody>
            {interview.categories.map((c) => (
              <tr key={c.id} className="border-t border-prism-border/50">
                <td className="py-2 font-bold">{c.name}</td>
                <td className="font-mono text-xs">{c.cpcCode ?? "—"}</td>
                <td>{c.revenueBasis === "PERCENT" ? `${amountText(c.revenuePercent)} %` : amountText(c.revenueValue)}</td>
                <td>{c.products.length} of {c.productCount ?? "?"}</td>
                <td className="text-right">{comment("CATEGORY", c.id, c.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {interview.revenue.quarterly.length ? (
        <Section title="Quarterly revenue">
          <div className="grid gap-2 sm:grid-cols-4">
            {interview.revenue.quarterly.map((q) => (
              <div key={q.id} className="rounded-2xl bg-prism-bg/70 p-3">
                <p className="text-[11px] font-bold text-prism-muted">Q{q.quarter} {q.year}</p>
                <p className="text-sm font-bold">{amountText(q.amount)}</p>
                {comment("QUARTERLY_REVENUE", q.id, `Q${q.quarter} ${q.year}`)}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {interview.categories.map((c) => c.products.map((p) => (
        <Section key={p.id} title={`${c.name} › ${p.name}`} note={`CPC ${p.cpcCode ?? "—"}`} actions={comment("PRODUCT", p.id, p.name)}>
          {p.seasonality ? (
            <p className="mb-3 text-xs text-prism-muted">
              Seasonality: {p.seasonality.producedAllYear ? "produced all year" : `available ${p.seasonality.availableMonths.map((m) => MONTHS[m - 1]).join(", ")}`};
              high {p.seasonality.highProductionMonths.map((m) => MONTHS[m - 1]).join(", ")}; low {p.seasonality.lowProductionMonths.map((m) => MONTHS[m - 1]).join(", ")};
              main buyer {codedText(snap.options, "mainBuyer", p.seasonality.mainBuyer)}.
              {comment("SEASONALITY", p.id, `${p.name} seasonality`)}
            </p>
          ) : null}
          {p.specifications.map((s, n) => <SpecificationView key={s.id} spec={s} n={n + 1} snap={snap} places={d.places} comment={comment} />)}
        </Section>
      )))}

      <Section title="Decisions and submissions">
        {d.reviewEvents.length ? (
          <ol className="space-y-3">
            {d.reviewEvents.map((e) => (
              <li key={e.reviewEventId} className="rounded-2xl bg-prism-bg/70 p-3 text-sm">
                <p className="font-bold">{e.decision === "APPROVED" ? "Approved" : "Returned"} at {STAGE_LABEL[e.stage]} review · submission {e.submissionNo}</p>
                <p className="text-xs text-prism-muted">{e.reviewerName}, {formatDateTime(e.reviewedAt)}</p>
                {e.reason ? <p className="mt-1 whitespace-pre-line">{e.reason}</p> : null}
                {e.comment ? <p className="mt-1 whitespace-pre-line text-prism-muted">{e.comment}</p> : null}
                {e.issues.length ? <ul className="mt-1 list-disc pl-5 text-xs">{e.issues.map((i, k) => <li key={k}>{i.comment}</li>)}</ul> : null}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-prism-muted">No decisions yet.</p>}
        <p className="mt-3 text-xs text-prism-muted">
          Submissions:{" "}
          {d.submissions.map((s, k) => (
            <span key={s.submissionId}>{k ? ", " : ""}<Link className={clsx("underline", s.submissionId === submissionId && "font-bold")} href={`/ppi/review/${s.submissionId}`}>{s.submissionNo}</Link></span>
          ))}
        </p>
        <button className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-prism-purple ring-1 ring-prism-border/70" onClick={() => setShowAudit((v) => !v)}>
          {showAudit ? "Hide change history" : "Show change history"}
        </button>
        {showAudit ? <AuditPanel initiationId={d.initiation.initiationId} /> : null}
      </Section>

      {d.canDecide ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-prism-border/70 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-prism-muted">{issues.length ? `${issues.length} comment${issues.length === 1 ? "" : "s"} for the enumerator` : "Add comments on any record to return it with them."}</p>
            <div className="flex gap-2">
              <button onClick={() => setDialog("RETURNED")} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">Return for correction</button>
              <button onClick={() => setDialog("APPROVED")} disabled={issues.length > 0} title={issues.length ? "Remove the comments or return the submission" : undefined} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-40">Approve</button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog ? <DecisionForm decision={dialog} issues={issues} onRemove={(k) => setIssues((l) => l.filter((_, i) => i !== k))} onClose={() => setDialog(null)} onSubmit={decide} /> : null}
    </article>
  );
}

// A construction count, its "not applicable (none)" answer, or unanswered.
function countText(value: unknown, notApplicable: unknown) {
  if (notApplicable === true) return "N/A (none)";
  return value == null || value === "" ? "—" : String(value);
}

function SpecificationView({ spec, n, snap, places, comment }: {
  spec: Specification; n: number; snap: Snapshot; places?: SubmissionDetail["places"];
  comment: (e: string, id: string, label: string, field?: string | null, subtle?: boolean) => ReactNode;
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
  return (
    <div className="mb-4 rounded-2xl border border-prism-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-bold">Specification {n}: {spec.details.description || "—"}</p>
        {comment("SPECIFICATION", spec.id, `Specification ${n}`)}
      </div>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">{facts.map(([k, v]) => <Fact key={k} label={k} value={v} />)}</dl>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Prices of specification {n}</caption>
          <thead><tr className="text-left text-prism-muted"><th scope="col" className="py-1 pr-3">Series</th><th scope="col" className="pr-3">Current</th>{months.map((m) => <th key={m} scope="col" className="pr-3 font-semibold">{monthLabel(m)}</th>)}</tr></thead>
          <tbody>
            {series.map((s) => {
              const current = spec.prices.find((p) => p.series === s && p.kind === "CURRENT");
              return (
                <tr key={s} className="border-t border-prism-border/40">
                  <th scope="row" className="py-1 pr-3 text-left font-bold">{SERIES_LABEL[s] ?? s}</th>
                  <td className="pr-3">
                    {current ? `${amountText(current.amount, `${codedText(snap.options, "currency", current.currency)} `)} (${monthLabel(current.month)})` : "—"}
                    {current?.reason ? <span className="mt-0.5 block whitespace-pre-line text-[11px] text-amber-900">Reason: {current.reason}</span> : null}
                    {current ? comment("PRICE", current.id, `${SERIES_LABEL[s]} current`, "amount") : null}
                  </td>
                  {months.map((m) => {
                    const h = spec.prices.find((p) => p.series === s && p.kind === "HISTORY" && p.month === m);
                    return (
                      <td key={m} className="group pr-3">
                        {h ? amountText(h.amount) : "—"}
                        {h?.reason ? <span className="block whitespace-pre-line text-[11px] text-amber-900" title={h.reason}>Reason: {h.reason}</span> : null}
                        {h ? comment("PRICE", h.id, `${SERIES_LABEL[s]} ${monthLabel(m)}`, "amount", true) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, note, actions, children }: { title: string; note?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prism-border/60">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-prism-text">{title}</h2>
          {note ? <p className="text-xs text-prism-muted">{note}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-prism-muted">{label}</dt>
      <dd className={clsx("text-sm", tone === "ok" && "font-bold text-emerald-700", tone === "warn" && "font-bold text-amber-800")}>{value}</dd>
    </div>
  );
}

// "Comment" on one record: the text goes to the enumerator with a return.
function CommentButton({ label, onAdd, subtle = false }: { label: string; onAdd: (text: string) => void; subtle?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx("ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-prism-purple ring-1 ring-prism-border/70 hover:bg-prism-bg", subtle && "opacity-0 focus:opacity-100 group-hover:opacity-100")}
        aria-label={`Comment on ${label}`}
      >
        Comment
      </button>
    );
  }
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
    setOpen(false);
  };
  return (
    <form onSubmit={save} className="mt-1 flex gap-1">
      <label className="sr-only" htmlFor={`c-${label}`}>Comment on {label}</label>
      <input id={`c-${label}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1 rounded-lg px-2 py-1 text-xs ring-1 ring-prism-border" placeholder="What should be corrected?" />
      <button className="rounded-lg bg-prism-purple px-2 text-[11px] font-bold text-white">Add</button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 text-[11px] font-bold text-prism-muted">Cancel</button>
    </form>
  );
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
            <button disabled={tooShort || busy} className={clsx("rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40", returning ? "bg-rose-600" : "bg-teal-700")}>
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
            <p className="font-bold">{c.entityType.toLowerCase().replace("_", " ")} {c.operation.toLowerCase()} · {c.actorName} · {formatDateTime(c.loggedAt)}</p>
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
