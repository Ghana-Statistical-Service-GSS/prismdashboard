"use client";

// Save as you go. Every edit changes the local copy at once and marks its
// record for saving; after a short pause the outbox sends the marked records
// in the order they were first changed (so a category reaches the server
// before its products), up to 25 per request, one request at a time.
//
// - One entry per record. Once an entry has been sent its operation (id and
//   payload) is frozen, so a retry after a lost answer is the same operation
//   and the server's receipt answers it (applied once). An edit made while it
//   is on its way is sent next, as a new operation on the new version.
// - No connection or a server error: the frozen operations are retried with
//   a growing pause (up to 30 s) and at once when the browser is back online.
//   Nothing is dropped; leaving the page while something is unsaved asks
//   first. Unsaved changes live only in this page (no offline storage).
// - Refused values (INVALID...): the server's message is shown at the field,
//   the typed value is kept, and the next edit of that record sends it again.
// - Changed elsewhere (another tab: VERSION_CONFLICT and the like): the rest
//   is saved, then the form reloads from the server and says which changes
//   to check.
// - The form closed (handed over, taken over, expired...): onClosed. The
//   session ended: onSessionLost; the outbox keeps its entries and resumes
//   with resume() once the code was entered again.
import { useCallback, useEffect, useRef, useState } from "react";
import { firmApi, NetworkError } from "./api";
import { buildOp, fromServer, recordIdOf, uuid, withVersion } from "./model";
import type { Doc, FieldError, FirmFormResponse, Operation } from "./types";

type Entry = {
  key: string;
  op: Operation | null;
  dirty: boolean;
  status: "waiting" | "sending" | "retry" | "error";
};

export type RecordError = { message: string; errors: FieldError[] };
export type SaveState = { kind: "idle" | "saving" | "saved" | "retrying" | "error"; unsaved: number; errorCount: number };

const CONFLICT_CODES = new Set(["VERSION_CONFLICT", "RECORD_EXISTS", "RECORD_GONE", "RECORD_DELETED", "DUPLICATE_OBSERVATION"]);
const PAUSE_MS = 700;
const LABELS: Record<string, string> = {
  INIT: "revenue or establishment information", EST: "general information", CAT: "a product category", PROD: "a product",
  SEAS: "seasonality", SPEC: "a pricing specification", PRICE: "a price", QTR: "quarterly revenue",
};
const conflictLabel = (k: string) => LABELS[k.replace(/^DEL-/, "").split(":")[0]] || "an answer";
const BATCH = 25;

export function useFirmForm({ slug, csrf, form, onClosed, onSessionLost }: {
  slug: string;
  csrf: string;
  form: FirmFormResponse;
  onClosed: (reason: string | null) => void;
  onSessionLost: () => void;
}) {
  const [doc, setDoc] = useState<Doc>(() => fromServer(form));
  const [serverForm, setServerForm] = useState(form);
  const [errors, setErrorsState] = useState<Map<string, RecordError>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const [outbox, setOutbox] = useState({ keys: new Set<string>(), errorCount: 0, retrying: false });
  const [everSaved, setEverSaved] = useState(false);
  const errorsRef = useRef(errors);

  const docRef = useRef(doc);
  const entries = useRef(new Map<string, Entry>());
  const tombstones = useRef(new Map<string, number | null>());
  const deleted = useRef(new Set<string>());
  const conflicts = useRef<string[]>([]);
  const sending = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const csrfRef = useRef(csrf);
  const callbacks = useRef({ onClosed, onSessionLost });
  const editable = useRef(form.establishment.editableFields);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { csrfRef.current = csrf; }, [csrf]);
  useEffect(() => { callbacks.current = { onClosed, onSessionLost }; }, [onClosed, onSessionLost]);

  const setErrors = (next: Map<string, RecordError>) => { errorsRef.current = next; setErrorsState(next); };
  // The outbox as the screen shows it (entries live in a ref).
  const rerender = () => {
    const all = [...entries.current.values()];
    setOutbox({ keys: new Set(all.map((e) => e.key)), errorCount: all.filter((e) => e.status === "error").length, retrying: all.some((e) => e.status === "retry") });
  };
  const commitDoc = (next: Doc) => { docRef.current = next; setDoc(next); };

  const schedule = useCallback((ms = PAUSE_MS) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flushRef.current(); }, ms);
  }, []);

  const mark = useCallback((k: string) => {
    const e = entries.current.get(k);
    if (!e) entries.current.set(k, { key: k, op: null, dirty: false, status: "waiting" });
    else if (e.op && (e.status === "sending" || e.status === "retry")) e.dirty = true;
    else { e.op = null; e.dirty = false; e.status = "waiting"; }
  }, []);

  // Changes the local copy and marks the records to save.
  const update = useCallback((mutate: (d: Doc) => void, keys: string[]) => {
    const next = structuredClone(docRef.current);
    mutate(next);
    commitDoc(next);
    keys.forEach(mark);
    rerender();
    schedule();
  }, [mark, schedule]);

  // Removes records here and, when the server has them, deletes them there
  // (the server deletes their children with them).
  const remove = useCallback((kind: "CAT" | "PROD" | "SPEC", id: string, mutate: (d: Doc) => string[]) => {
    const next = structuredClone(docRef.current);
    const list = kind === "CAT" ? next.categories : kind === "PROD" ? next.products : next.specs;
    const version = (list as { id: string; version: number | null }[]).find((x) => x.id === id)?.version ?? null;
    const gone = [id, ...mutate(next)];
    commitDoc(next);
    for (const g of gone) deleted.current.add(g);
    // Unsent saves of these records are dropped; a sent one finishes first.
    let inFlight = false;
    const errs = new Map(errorsRef.current);
    for (const [k, e] of entries.current) {
      if (!gone.includes(recordIdOf(k))) continue;
      if (e.op) { if (recordIdOf(k) === id) inFlight = true; } else entries.current.delete(k);
      errs.delete(k);
    }
    setErrors(errs);
    tombstones.current.set(id, version);
    if (version != null || inFlight) entries.current.set(`DEL-${kind}:${id}`, { key: `DEL-${kind}:${id}`, op: null, dirty: false, status: "waiting" });
    rerender();
    schedule(0);
  }, [schedule]);

  const reload = useCallback(async () => {
    const answer = await firmApi.form(slug);
    if (answer.status === 410) { stopped.current = true; callbacks.current.onClosed(answer.error?.closedReason ?? null); return false; }
    if (answer.status === 401 || answer.status === 403) { callbacks.current.onSessionLost(); return false; }
    if (!answer.data) return false;
    entries.current.clear();
    tombstones.current.clear();
    deleted.current.clear();
    setErrors(new Map());
    setServerForm(answer.data);
    editable.current = answer.data.establishment.editableFields;
    commitDoc(fromServer(answer.data));
    rerender();
    return true;
  }, [slug]);

  // The server's latest check (readiness) without touching the local copy:
  // for the review when some answers were refused (reload would drop them
  // and their messages).
  const refreshChecks = useCallback(async () => {
    const answer = await firmApi.form(slug);
    if (answer.status === 410) { stopped.current = true; callbacks.current.onClosed(answer.error?.closedReason ?? null); return false; }
    if (answer.status === 401 || answer.status === 403) { callbacks.current.onSessionLost(); return false; }
    if (!answer.data) return false;
    const { readiness, contacts } = answer.data;
    setServerForm((current) => ({ ...current, readiness, contacts }));
    return true;
  }, [slug]);

  // The session ended outside a save (e.g. the hand-over): ask for the code again.
  const sessionLost = useCallback(() => callbacks.current.onSessionLost(), []);

  const flush = useCallback(async () => {
    if (sending.current || stopped.current) return;
    const ready: Entry[] = [];
    for (const e of entries.current.values()) {
      if (ready.length >= BATCH) break;
      if (e.status !== "waiting" && e.status !== "retry") continue;
      // A delete waits until its record's own save has finished.
      if (e.key.startsWith("DEL-")) {
        const target = e.key.slice(4);
        if (entries.current.has(target)) continue;
      }
      ready.push(e);
    }
    if (!ready.length) {
      if (conflicts.current.length && ![...entries.current.values()].some((e) => e.status === "sending")) {
        const names = [...new Set(conflicts.current)];
        conflicts.current = [];
        if (await reload()) {
          setNotice(`Some changes were not saved because this form was changed in another window or tab (${names.join(", ")}). We have loaded the latest answers: please check your last changes.`);
        }
      }
      return;
    }
    sending.current = true;
    const ops: Operation[] = [];
    const sent: Entry[] = [];
    for (const e of ready) {
      if (!e.op) {
        const op = buildOp(docRef.current, e.key, uuid(), editable.current, tombstones.current);
        if (!op) { entries.current.delete(e.key); continue; }
        e.op = op;
        e.dirty = false;
      }
      e.status = "sending";
      ops.push(e.op);
      sent.push(e);
    }
    rerender();
    if (!ops.length) { sending.current = false; schedule(0); return; }

    const retryLater = () => {
      for (const e of sent) e.status = "retry";
      failures.current += 1;
      sending.current = false;
      rerender();
      schedule(Math.min(30_000, 1000 * 2 ** Math.min(failures.current, 5)));
    };
    let answer;
    try {
      answer = await firmApi.save(slug, csrfRef.current, ops);
    } catch (error) {
      if (error instanceof NetworkError) { retryLater(); return; }
      throw error;
    }
    if (answer.status === 410) {
      stopped.current = true;
      sending.current = false;
      callbacks.current.onClosed(answer.error?.closedReason ?? null);
      return;
    }
    if (answer.status === 401 || (answer.status === 403 && ["CSRF_FAILED", "NOT_THIS_FORM"].includes(answer.error?.code || ""))) {
      for (const e of sent) e.status = "retry";
      sending.current = false;
      rerender();
      callbacks.current.onSessionLost();
      return;
    }
    // Too many saves in a short time (the server's per-session limit): the
    // same entries go again after the wait it gives.
    if (answer.status === 429) {
      for (const e of sent) e.status = "retry";
      sending.current = false;
      rerender();
      schedule(Math.min(60_000, Math.max(1, answer.error?.retryAfterSeconds || 5) * 1000));
      return;
    }
    if (!answer.data) { retryLater(); return; }
    failures.current = 0;
    const next = structuredClone(docRef.current);
    const newErrors = new Map(errorsRef.current);
    let closedReason: string | null | undefined;
    answer.data.results.forEach((result, index) => {
      const e = sent[index];
      if (!e) return;
      const id = recordIdOf(e.key);
      const isDelete = e.key.startsWith("DEL-");
      if (result.initiation?.version != null) next.initiationVersion = result.initiation.version;
      if (!isDelete && deleted.current.has(id)) {
        // Saved just before it was removed here: its delete can go now.
        if (result.status === "APPLIED") tombstones.current.set(id, result.version ?? null);
        entries.current.delete(e.key);
        return;
      }
      if (result.status === "APPLIED") {
        if (!isDelete) withVersion(next, e.key, result.version);
        newErrors.delete(e.key);
        if (e.dirty) { e.op = null; e.dirty = false; e.status = "waiting"; } else entries.current.delete(e.key);
        setEverSaved(true);
        return;
      }
      if (result.code === "INVITE_CLOSED") { closedReason = result.closedReason ?? null; return; }
      if (result.status === "ERROR") { e.status = "retry"; return; }
      if (result.status === "CONFLICT" && CONFLICT_CODES.has(result.code || "")) {
        entries.current.delete(e.key);
        conflicts.current.push(conflictLabel(e.key));
        return;
      }
      // Refused: shown at the record; the next edit sends it again.
      newErrors.set(e.key, { message: result.message || "This answer could not be saved.", errors: result.errors || [] });
      if (e.dirty) { e.op = null; e.dirty = false; e.status = "waiting"; } else { e.op = null; e.status = "error"; }
    });
    commitDoc(next);
    setErrors(newErrors);
    sending.current = false;
    if (closedReason !== undefined || answer.data.invite.closedReason) {
      stopped.current = true;
      callbacks.current.onClosed(closedReason ?? answer.data.invite.closedReason ?? null);
      return;
    }
    rerender();
    schedule(0);
  }, [reload, schedule, slug]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Back online: try at once.
  useEffect(() => {
    const online = () => { failures.current = 0; schedule(0); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [schedule]);

  // Leaving with unsaved changes asks first.
  const unsaved = outbox.keys.size;
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const state: SaveState = {
    unsaved,
    errorCount: outbox.errorCount,
    kind: outbox.errorCount ? "error" : outbox.retrying ? "retrying" : unsaved ? "saving" : everSaved ? "saved" : "idle",
  };

  // Waits (up to `ms`) until nothing is left to send: "saved" (everything
  // accepted), "refused" (only answers the server refused remain: they are
  // not saved, see `refused`), or "pending" (still unsent: no connection).
  const settle = useCallback(async (ms = 20_000): Promise<"saved" | "refused" | "pending"> => {
    const until = Date.now() + ms;
    schedule(0);
    while (Date.now() < until) {
      const pending = [...entries.current.values()];
      if (!pending.length && !sending.current) return "saved";
      if (!sending.current && pending.every((e) => e.status === "error")) return "refused";
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return "pending";
  }, [schedule]);

  // The answers the server refused (not saved), for the send confirmation.
  const refused = useCallback(() => [...errorsRef.current.entries()].map(([key, value]) => ({ key, label: conflictLabel(key), message: value.message })), []);

  const resume = useCallback(() => { failures.current = 0; schedule(0); }, [schedule]);
  const isPending = (k: string) => outbox.keys.has(k);

  return { doc, serverForm, update, remove, errors, notice, setNotice, state, settle, refused, reload, refreshChecks, sessionLost, resume, isPending };
}
