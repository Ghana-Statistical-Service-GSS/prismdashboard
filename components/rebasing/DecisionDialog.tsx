"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

export type Decision = "APPROVED" | "REJECTED";

const MIN_REASON = 5; // matches the backend's requiredText minimum

// Approve/reject confirmation. Rejection needs a written reason because the
// reader sees it on the phone; approval takes an optional note.
export function DecisionDialog({ decision, title, summary, approveLabel = "Approve", onSubmit, onClose }: {
  decision: Decision;
  title: string;
  summary: ReactNode;
  approveLabel?: string;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rejecting = decision === "REJECTED";
  const tooShort = rejecting && text.trim().length < MIN_REASON;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(text.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The decision could not be saved.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="decision-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${rejecting ? "text-rose-600" : "text-teal-700"}`}>{rejecting ? "Reject" : "Approve"}</p>
            <h2 id="decision-title" className="mt-1 text-lg font-black text-prism-text">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prism-bg text-lg font-bold text-prism-muted hover:text-prism-text disabled:opacity-40">×</button>
        </div>

        <div className="mt-4 rounded-2xl bg-prism-bg/70 p-4 text-xs text-prism-text">{summary}</div>

        <form method="post" onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-prism-muted">{rejecting ? "Reason for rejection (required)" : "Note (optional)"}</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              maxLength={1000}
              autoFocus={rejecting}
              placeholder={rejecting ? "Explain what the reader must check or correct" : "Add a note for the record"}
              className="mt-2 w-full rounded-2xl border border-prism-border bg-white px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
            />
            {rejecting && <span className="mt-1 block text-[11px] text-prism-muted">The Market Reader sees this reason on the phone. At least {MIN_REASON} characters.</span>}
          </label>

          {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-prism-border px-4 py-2.5 text-sm font-semibold text-prism-text hover:bg-prism-bg disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={busy || tooShort} className={`rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-40 ${rejecting ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"}`}>
              {busy ? "Saving…" : rejecting ? "Reject" : approveLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
