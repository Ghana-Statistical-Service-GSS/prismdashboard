"use client";

import clsx from "clsx";
import type { InviteStatus, Overview } from "./types";
import type { StatePatch } from "./useDashboardState";
import { count, INVITE, MODE_LABEL, pctText } from "./format";
import { focusRing, PageLink, Panel, Pill } from "./ui";

const ORDER: InviteStatus[] = ["INVITED", "OPENED", "FIRM_FILLING", "HANDED_OVER", "TAKEN_OVER", "EXPIRED", "CLOSED"];

// Firm self-interview: who completed each assigned establishment (the firm
// on its web form, or the enumerator) and where the firms' invites stand.
// A firm's answers are never a submission: only the enumerator submits.
export function SelfCompletionPanel({ overview, href }: { overview: Overview; href: (patch: StatePatch) => string }) {
  const s = overview.selfCompletion;
  if (!s) return null;
  const assigned = s.mode.SELF + s.mode.ENUMERATOR;
  const selfPct = assigned ? Math.round((s.mode.SELF / assigned) * 1000) / 10 : null;
  return (
    <Panel
      id="ppi-self-completion"
      title="Firm self-completion"
      hint="Self-completed: the firm entered answers on the web form (the enumerator still checks and submits them). Invites: each establishment's latest invite."
    >
      {!s.available ? (
        <p className="text-xs text-prism-muted">The firm web form is not set up on this server yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">Completed by</h3>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-prism-bg" aria-hidden="true">
              {s.mode.SELF > 0 && <div className="bg-violet-500" style={{ width: `${(s.mode.SELF / Math.max(assigned, 1)) * 100}%` }} />}
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {(["SELF", "ENUMERATOR"] as const).map((mode) => (
                <li key={mode} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className={clsx("h-2 w-2 rounded-full", mode === "SELF" ? "bg-violet-500" : "bg-prism-border")} aria-hidden="true" />
                    <PageLink href={href({ mode, view: "establishment", status: null, page: null })} className={clsx("font-bold text-prism-purple hover:underline", focusRing)}>
                      {MODE_LABEL[mode]}
                    </PageLink>
                  </span>
                  <strong className="tabular-nums text-prism-text">{count(s.mode[mode])}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-prism-muted">
              {pctText(selfPct)} of assigned establishments self-completed; {count(s.selfCompletedSubmitted)} of them submitted by their enumerator.
            </p>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">Invites ({count(s.invited)} establishments)</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {ORDER.map((status) => (
                <li key={status}><Pill className={INVITE[status].style}>{INVITE[status].label} {count(s.invites[status] ?? 0)}</Pill></li>
              ))}
            </ul>
            <p className={clsx("mt-2 text-[11px]", s.withMessageFailures ? "font-bold text-rose-700" : "text-prism-muted")}>
              {s.withMessageFailures
                ? `${count(s.messageFailures)} SMS/email message${s.messageFailures === 1 ? "" : "s"} could not be sent (${count(s.withMessageFailures)} establishment${s.withMessageFailures === 1 ? "" : "s"}); the enumerator can share the link and a new code.`
                : "No failed SMS/email messages."}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}
