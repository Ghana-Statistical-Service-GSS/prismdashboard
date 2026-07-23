"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type Settings = {
  enabled: boolean;
  work_started_at: string | null;
  reader_login_grace_days: number;
  supervisor_inactivity_days: number;
  approval_pending_hours: number;
  escalation_interval_hours: number;
  project_coordinator_email: string | null;
  deputy_gs_emails: string[];
  government_statistician_email: string | null;
  updated_at: string;
};

type AlertRow = {
  recipient_user_id: string;
  recipient_name: string;
  recipient_email: string;
  region_name: string;
  active_readers: number;
  readers_not_logged_in: number;
  active_supervisors: number;
  inactive_supervisors: number;
  supervisors_with_overdue_approvals: number;
  overdue_pending_quotes: number;
  markets_without_supervisor: number;
  unassigned_market_overdue_quotes: number;
  breach_count: number;
  last_stage: number;
  last_sent_at: string | null;
  next_stage: number | null;
  next_stage_code: "INFORM" | "WARN" | "QUERY" | null;
  send_eligible: boolean;
  eligible_at: string | null;
  state: "READY" | "COOLDOWN" | "CLEAR" | "DISABLED" | "ESCALATED" | "CONFIGURATION_REQUIRED";
};

type HistoryRow = {
  notification_id: string;
  region_name: string;
  recipient_name: string;
  recipient_email: string;
  stage: number;
  status: "QUEUED" | "SENT" | "FAILED";
  subject: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type Overview = {
  generated_at: string;
  smtp_configured: boolean;
  leadership_ready: boolean;
  settings: Settings;
  rows: AlertRow[];
  history: HistoryRow[];
};

type SettingsForm = {
  enabled: boolean;
  workStartedAt: string;
  readerLoginGraceDays: number;
  supervisorInactivityDays: number;
  approvalPendingHours: number;
  escalationIntervalHours: number;
  projectCoordinatorEmail: string;
  deputyOne: string;
  deputyTwo: string;
  governmentStatisticianEmail: string;
};

type Draft = {
  to: string;
  cc: string[];
  replyTo: string | null;
  subject: string;
  text: string;
  stage: number;
  stageCode: "INFORM" | "WARN" | "QUERY";
};

const number = new Intl.NumberFormat("en-GH");
const inputClass = "mt-2 w-full rounded-xl border border-prism-border bg-white px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-prism-text outline-none focus:border-prism-purple";

function date(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formFrom(settings: Settings): SettingsForm {
  return {
    enabled: settings.enabled,
    workStartedAt: settings.work_started_at?.slice(0, 10) || "",
    readerLoginGraceDays: settings.reader_login_grace_days,
    supervisorInactivityDays: settings.supervisor_inactivity_days,
    approvalPendingHours: settings.approval_pending_hours,
    escalationIntervalHours: settings.escalation_interval_hours,
    projectCoordinatorEmail: settings.project_coordinator_email || "",
    deputyOne: settings.deputy_gs_emails?.[0] || "",
    deputyTwo: settings.deputy_gs_emails?.[1] || "",
    governmentStatisticianEmail: settings.government_statistician_email || "",
  };
}

export default function EmailAlertsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dashboard/email-alerts", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to load email escalations");
      setData(body);
      setForm(formFrom(body.settings));
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const rankedRows = useMemo(() => [...(data?.rows || [])].sort((a, b) => {
    const priority = (row: AlertRow) => row.state === "READY" ? 0 : row.state === "COOLDOWN" ? 1 : row.state === "DISABLED" ? 2 : row.state === "ESCALATED" ? 3 : 4;
    return priority(a) - priority(b) || b.breach_count - a.breach_count || a.region_name.localeCompare(b.region_name);
  }), [data]);

  async function saveSettings() {
    if (!form) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/dashboard/email-alerts/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          workStartedAt: form.workStartedAt,
          readerLoginGraceDays: Number(form.readerLoginGraceDays),
          supervisorInactivityDays: Number(form.supervisorInactivityDays),
          approvalPendingHours: Number(form.approvalPendingHours),
          escalationIntervalHours: Number(form.escalationIntervalHours),
          projectCoordinatorEmail: form.projectCoordinatorEmail,
          deputyGsEmails: [form.deputyOne, form.deputyTwo].filter(Boolean),
          governmentStatisticianEmail: form.governmentStatisticianEmail,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to save escalation settings");
      setNotice("Email escalation settings saved. No email was sent.");
      setSettingsOpen(false);
      await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  const ready = data?.rows.filter((row) => row.state === "READY").length || 0;
  const breaches = data?.rows.reduce((sum, row) => sum + row.breach_count, 0) || 0;
  const queryStage = data?.rows.filter((row) => row.next_stage === 3 || row.state === "ESCALATED").length || 0;

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="min-w-0 flex-1"><Topbar />
        <main className="px-5 py-7 md:px-8 xl:px-10">
          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-teal">Communications · HQ only</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-prism-text md:text-4xl">RS Email Escalations</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-prism-muted">Evidence-based regional alerts progress from information to warning and then formal query. PRISM reports operational exceptions; administrative conclusions remain with management.</p>
            </div>
            <button onClick={() => setSettingsOpen((value) => !value)} className="rounded-full bg-prism-purple px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white">{settingsOpen ? "Close settings" : "Escalation settings"}</button>
          </header>

          {error && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {notice && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div>}
          {loading && <div className="mt-8 rounded-3xl bg-white p-12 text-center text-sm text-prism-muted shadow-sm">Calculating regional supervision exceptions…</div>}

          {data && form && (
            <>
              {(!data.settings.enabled || !data.settings.work_started_at) && <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900"><strong>Email sending is currently disabled.</strong> Configure the official work-start date and review the thresholds before enabling it.</div>}
              {!data.smtp_configured && <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-800">SMTP is not configured on the backend. Alerts cannot be enabled or sent.</div>}

              {settingsOpen && (
                <section className="mt-6 rounded-3xl border border-prism-border bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-prism-text">Work cycle and escalation rules</h2><p className="mt-1 text-xs text-prism-muted">Changing the work-start date begins a new escalation cycle. Previous history is retained.</p></div><label className="flex items-center gap-2 text-xs font-bold text-prism-text"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-4 w-4 accent-prism-purple" />Enable sending</label></div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Official work start date"><input type="date" value={form.workStartedAt} onChange={(event) => setForm({ ...form, workStartedAt: event.target.value })} className={inputClass} /></Field>
                    <NumberField label="Reader login grace (days)" value={form.readerLoginGraceDays} onChange={(value) => setForm({ ...form, readerLoginGraceDays: value })} />
                    <NumberField label="Supervisor inactivity (days)" value={form.supervisorInactivityDays} onChange={(value) => setForm({ ...form, supervisorInactivityDays: value })} />
                    <NumberField label="Pending approval threshold (hours)" value={form.approvalPendingHours} onChange={(value) => setForm({ ...form, approvalPendingHours: value })} />
                    <NumberField label="Escalation interval (hours)" value={form.escalationIntervalHours} onChange={(value) => setForm({ ...form, escalationIntervalHours: value })} />
                    <Field label="Project Coordinator email"><input type="email" value={form.projectCoordinatorEmail} onChange={(event) => setForm({ ...form, projectCoordinatorEmail: event.target.value })} className={inputClass} /></Field>
                    <Field label="Deputy Government Statistician 1"><input type="email" value={form.deputyOne} onChange={(event) => setForm({ ...form, deputyOne: event.target.value })} className={inputClass} /></Field>
                    <Field label="Deputy Government Statistician 2"><input type="email" value={form.deputyTwo} onChange={(event) => setForm({ ...form, deputyTwo: event.target.value })} className={inputClass} /></Field>
                    <Field label="Government Statistician email"><input type="email" value={form.governmentStatisticianEmail} onChange={(event) => setForm({ ...form, governmentStatisticianEmail: event.target.value })} className={inputClass} /></Field>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className={`text-xs font-bold ${data.leadership_ready ? "text-emerald-700" : "text-amber-700"}`}>{data.leadership_ready ? "Formal-query leadership recipients are configured." : "Stage 3 remains blocked until the Project Coordinator, two Deputies and Government Statistician are configured."}</p><button disabled={saving} onClick={saveSettings} className="rounded-full bg-prism-teal px-5 py-2.5 text-xs font-black text-prism-text disabled:opacity-40">{saving ? "Saving…" : "Save settings"}</button></div>
                </section>
              )}

              <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="RS recipients" value={data.rows.length} detail="Active Regional Statisticians" />
                <Stat label="Operational breaches" value={breaches} detail="Across all current metrics" tone="red" />
                <Stat label="Ready to send" value={ready} detail="Eligible after cooldown rules" tone="amber" />
                <Stat label="Query stage" value={queryStage} detail="Awaiting or completed stage 3" tone="purple" />
              </section>

              <section className="mt-7 overflow-hidden rounded-3xl border border-prism-border bg-white shadow-sm">
                <div className="border-b border-prism-border px-5 py-4"><h2 className="font-black text-prism-text">Regional escalation register</h2><p className="mt-1 text-xs text-prism-muted">Highest operational exception counts are shown first within each escalation status.</p></div>
                <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-4 py-3">Region / RS</th><th className="px-4 py-3 text-right">Readers not logged</th><th className="px-4 py-3 text-right">Inactive supervisors</th><th className="px-4 py-3 text-right">Approval exceptions</th><th className="px-4 py-3 text-right">Unassigned markets</th><th className="px-4 py-3">Escalation</th><th className="px-4 py-3">Action</th></tr></thead>
                  <tbody>{rankedRows.map((row) => <tr key={row.recipient_user_id} className="border-t border-prism-border/60 align-top"><td className="px-4 py-4"><p className="font-black text-prism-text">{row.region_name}</p><p className="mt-1 text-[10px] text-prism-muted">{row.recipient_name} · {row.recipient_email}</p></td><MetricCell value={row.readers_not_logged_in} total={row.active_readers} /><MetricCell value={row.inactive_supervisors} total={row.active_supervisors} /><td className="px-4 py-4 text-right"><p className="font-black text-prism-text">{number.format(row.supervisors_with_overdue_approvals)}</p><p className="mt-1 text-[10px] text-prism-muted">{number.format(row.overdue_pending_quotes)} overdue prices</p></td><td className="px-4 py-4 text-right"><p className="font-black text-prism-text">{number.format(row.markets_without_supervisor)}</p><p className="mt-1 text-[10px] text-prism-muted">{number.format(row.unassigned_market_overdue_quotes)} overdue prices</p></td><td className="px-4 py-4"><StageBadge row={row} /><p className="mt-2 text-[10px] text-prism-muted">Last sent: {date(row.last_sent_at)}</p>{row.state === "COOLDOWN" && <p className="mt-1 text-[10px] text-amber-700">Due {date(row.eligible_at)}</p>}</td><td className="px-4 py-4"><button disabled={!row.next_stage} onClick={() => setPreviewUserId(row.recipient_user_id)} className="rounded-full bg-prism-bg px-3 py-2 text-[10px] font-black text-prism-purple disabled:opacity-35">Preview {row.next_stage_code ? row.next_stage_code.toLowerCase() : ""}</button></td></tr>)}</tbody>
                </table></div>
              </section>

              <section className="mt-7 overflow-hidden rounded-3xl border border-prism-border bg-white shadow-sm">
                <div className="border-b border-prism-border px-5 py-4"><h2 className="font-black text-prism-text">Email audit history</h2><p className="mt-1 text-xs text-prism-muted">Queued, successful and failed attempts are retained.</p></div>
                <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.13em] text-prism-muted"><tr><th className="px-4 py-3">Region / recipient</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Time</th></tr></thead><tbody>{data.history.map((row) => <tr key={row.notification_id} className="border-t border-prism-border/60"><td className="px-4 py-4"><p className="font-bold text-prism-text">{row.region_name}</p><p className="text-[10px] text-prism-muted">{row.recipient_name} · {row.recipient_email}</p></td><td className="px-4 py-4 font-black text-prism-purple">{row.stage}</td><td className="max-w-md px-4 py-4 text-prism-text">{row.subject}{row.error_message && <p className="mt-1 text-[10px] text-red-600">{row.error_message}</p>}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${row.status === "SENT" ? "bg-emerald-100 text-emerald-700" : row.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{row.status}</span></td><td className="whitespace-nowrap px-4 py-4 text-prism-muted">{date(row.sent_at || row.created_at)}</td></tr>)}{!data.history.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-prism-muted">No escalation emails have been attempted.</td></tr>}</tbody></table></div>
              </section>
            </>
          )}
        </main>
      </div>
      {previewUserId && <PreviewModal userId={previewUserId} enabled={Boolean(data?.settings.enabled)} leadershipReady={Boolean(data?.leadership_ready)} onClose={() => setPreviewUserId(null)} onSent={async (message) => { setPreviewUserId(null); setNotice(message); await load(); }} />}
    </div>
  );
}

function PreviewModal({ userId, enabled, leadershipReady, onClose, onSent }: { userId: string; enabled: boolean; leadershipReady: boolean; onClose: () => void; onSent: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [row, setRow] = useState<AlertRow | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard/email-alerts/${userId}/preview`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message || "Unable to build email preview"); return body; })
      .then((body) => { setDraft(body.draft); setRow(body.row); })
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [userId]);

  async function send() {
    if (!draft || !row) return;
    const formal = draft.stage === 3;
    if (!window.confirm(`${formal ? "Send this formal query" : "Send this escalation email"} to ${draft.to}? This action will be recorded in the audit history.`)) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/dashboard/email-alerts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientUserId: userId, expectedStage: draft.stage }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "Unable to send escalation email");
      await onSent(`Stage ${draft.stage} email sent to ${draft.to}.`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSending(false); }
  }

  const sendBlocked = !enabled || !row?.send_eligible || (draft?.stage === 3 && !leadershipReady);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Email escalation preview" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-prism-border p-5"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-prism-teal">Email preview · no message sent yet</p><h2 className="mt-1 text-xl font-black text-prism-text">{draft?.subject || "Preparing preview…"}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted">×</button></header>{error ? <div className="m-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : !draft || !row ? <p className="p-12 text-center text-sm text-prism-muted">Building the latest evidence snapshot…</p> : <><div className="overflow-auto p-5"><dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs md:grid-cols-2"><div><dt className="font-black uppercase tracking-wider text-prism-muted">To</dt><dd className="mt-1 text-prism-text">{draft.to}</dd></div><div><dt className="font-black uppercase tracking-wider text-prism-muted">Stage</dt><dd className="mt-1 font-bold text-prism-text">{draft.stage} · {draft.stageCode}</dd></div><div><dt className="font-black uppercase tracking-wider text-prism-muted">CC</dt><dd className="mt-1 text-prism-text">{draft.cc.length ? draft.cc.join(", ") : "None"}</dd></div><div><dt className="font-black uppercase tracking-wider text-prism-muted">Reply-To</dt><dd className="mt-1 text-prism-text">{draft.replyTo || "System mailbox"}</dd></div></dl><pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-prism-border p-5 font-sans text-sm leading-6 text-prism-text">{draft.text}</pre></div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-prism-border p-5"><p className="text-xs text-prism-muted">{!enabled ? "Enable sending in settings first." : row.state === "COOLDOWN" ? `Next stage becomes eligible ${date(row.eligible_at)}.` : draft.stage === 3 && !leadershipReady ? "Configure all leadership recipients before sending stage 3." : "The current metrics and final content will be stored in the audit log."}</p><div className="flex gap-2"><button onClick={onClose} className="rounded-full bg-prism-bg px-4 py-2 text-xs font-bold text-prism-purple">Cancel</button><button disabled={sendBlocked || sending} onClick={send} className={`rounded-full px-5 py-2 text-xs font-black text-white disabled:opacity-40 ${draft.stage === 3 ? "bg-red-700" : "bg-prism-purple"}`}>{sending ? "Sending…" : draft.stage === 3 ? "Send formal query" : `Send stage ${draft.stage}`}</button></div></footer></>}</section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-prism-muted">{label}{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className={inputClass} /></Field>; }
function Stat({ label, value, detail, tone = "teal" }: { label: string; value: number; detail: string; tone?: "teal" | "red" | "amber" | "purple" }) { const colors = { teal: "bg-prism-teal", red: "bg-red-600", amber: "bg-amber-500", purple: "bg-prism-purple" }; return <article className="relative overflow-hidden rounded-3xl border border-prism-border bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1.5 ${colors[tone]}`} /><p className="text-[10px] font-black uppercase tracking-[0.15em] text-prism-muted">{label}</p><p className="mt-3 text-3xl font-black text-prism-text">{number.format(value)}</p><p className="mt-1 text-xs text-prism-muted">{detail}</p></article>; }
function MetricCell({ value, total }: { value: number; total: number }) { return <td className="px-4 py-4 text-right"><p className={`font-black ${value ? "text-red-700" : "text-prism-text"}`}>{number.format(value)}</p><p className="mt-1 text-[10px] text-prism-muted">of {number.format(total)}</p></td>; }
function StageBadge({ row }: { row: AlertRow }) { const label = row.state === "CLEAR" ? "Clear" : row.state === "ESCALATED" ? "Query sent" : row.next_stage_code || row.state; const tone = row.state === "READY" ? row.next_stage === 3 ? "bg-red-100 text-red-700" : row.next_stage === 2 ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800" : row.state === "CLEAR" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${tone}`}>{label}</span>; }
