"use client";

// The firm's public web form: link check -> access code -> the questionnaire
// (saved as you go) -> "Review & send". A closed form shows a polite
// page and no data from the server (only the thank-you page may show the
// copy this page itself just sent).
import { useCallback, useEffect, useRef, useState } from "react";
import { firmApi, NetworkError } from "./api";
import { Button, inputClass } from "./fields";
import { ProductsStep } from "./products";
import { ReviewStep, ThankYou, type SentCopy } from "./review";
import { SeasonalityStep } from "./seasonality";
import { GeneralStep, QuarterlyStep, RevenueStep } from "./sections";
import type { FirmFormResponse } from "./types";
import { useFirmForm } from "./useFirmForm";

type Phase =
  | { kind: "loading" }
  | { kind: "closed"; reason: string | null; justSent?: boolean; copy?: SentCopy }
  | { kind: "code"; message?: string; resumed?: boolean }
  | { kind: "locked"; until: number; busy?: boolean }
  | { kind: "form"; csrf: string; form: FirmFormResponse }
  | { kind: "offline" }
  // The server answered that the form is switched off or not set up (503).
  | { kind: "unavailable" };

export function FirmApp({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // The session ended while the form was open: the form stays mounted (with
  // its unsaved changes) behind the code prompt and resumes saving after it.
  const [reauth, setReauth] = useState<{ message?: string; until?: number } | null>(null);

  const openForm = useCallback(async (csrf: string) => {
    const answer = await firmApi.form(slug);
    if (answer.data) { setPhase({ kind: "form", csrf, form: answer.data }); return; }
    if (answer.status === 410) setPhase({ kind: "closed", reason: answer.error?.closedReason ?? null });
    else if (answer.status === 401 || answer.status === 403) setPhase({ kind: "code" });
    else setPhase({ kind: unavailable(answer) ? "unavailable" : "offline" });
  }, [slug]);

  const start = useCallback(async () => {
    try {
      const answer = await firmApi.link(slug);
      // Too many requests from this network (a lookup flood limit, shared by
      // everyone behind the same address): a neutral wait page.
      if (answer.status === 429) return setPhase({ kind: "locked", busy: true, until: Date.now() + (answer.error?.retryAfterSeconds || 60) * 1000 });
      if (!answer.data) return setPhase({ kind: unavailable(answer) ? "unavailable" : "offline" });
      if (answer.data.session && answer.data.state === "CLOSED") return setPhase({ kind: "closed", reason: answer.data.closedReason });
      if (answer.data.session) return await openForm(answer.data.session.csrfToken);
      return setPhase({ kind: "code" });
    } catch (error) {
      if (error instanceof NetworkError) return setPhase({ kind: "offline" });
      throw error;
    }
  }, [openForm, slug]);

  useEffect(() => {
    // Loads the link's state once on arrival (an external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
  }, [start]);

  const onCode = async (code: string) => {
    try {
      let answer = await firmApi.start(slug, code);
      // A wait of a few seconds (the link is being guessed at: attempts are
      // spaced out): wait and try again by itself, a few times.
      for (let tries = 0; answer.status === 429 && answer.error?.code === "SLOW_DOWN" && tries < 4; tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, ((answer.error?.retryAfterSeconds ?? 5) + 0.5) * 1000));
        answer = await firmApi.start(slug, code);
      }
      if (answer.data) {
        if (phase.kind === "form" && reauth) {
          setPhase({ ...phase, csrf: answer.data.csrfToken });
          setReauth(null);
          return;
        }
        await openForm(answer.data.csrfToken);
        return;
      }
      const e = answer.error;
      // While the form is open behind the code prompt (re-entering the code
      // after the session ended), everything except a closed form is shown
      // inside the prompt: the form, and the answers still waiting to be
      // saved, stay mounted. Only a closed form leaves it.
      const reauthing = phase.kind === "form" && !!reauth;
      const show = (message: string, until?: number) => (reauthing ? setReauth({ message, until }) : setPhase({ kind: "code", message }));
      if (answer.status === 410) { setReauth(null); setPhase({ kind: "closed", reason: e?.closedReason ?? null }); }
      else if (answer.status === 429) {
        const until = Date.now() + (e?.retryAfterSeconds || 60) * 1000;
        // Wrong codes from this device (its lock) vs too many requests from
        // the network (or a wait that did not clear): told apart by code.
        const wrongCodes = e?.code === "TOO_MANY_ATTEMPTS";
        if (reauthing) {
          show(wrongCodes
            ? "Too many wrong codes from this device. Please wait before trying again; your unsaved answers are kept on this page."
            : "Too many requests from your network at the moment. Please wait before trying again; your unsaved answers are kept on this page.", until);
        } else setPhase({ kind: "locked", until, busy: !wrongCodes });
      } else if (e?.code === "WRONG_CODE") {
        show("That code is not right for this link. Please check the link and the code. After several wrong codes the form is locked for a while on this device.");
      } else show(e?.message || "Something went wrong. Please try again.");
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error;
      if (phase.kind === "form" && reauth) setReauth({ message: "No connection. Check your internet connection and try again." });
      else setPhase({ kind: "code", message: "No connection. Check your internet connection and try again." });
    }
  };

  switch (phase.kind) {
    case "loading":
      return <p className="rounded-2xl bg-white p-8 text-center text-prism-muted" role="status">Loading your questionnaire…</p>;
    case "offline":
      return (
        <Message title="We could not reach the server">
          <p>Please check your internet connection and try again.</p>
          <Button onClick={() => { setPhase({ kind: "loading" }); void start(); }}>Try again</Button>
        </Message>
      );
    case "unavailable":
      return (
        <Message title="The online form is not available right now">
          <p>Please try again later. If this continues, contact your GSS enumerator: they can also complete the questionnaire with you.</p>
          <Button onClick={() => { setPhase({ kind: "loading" }); void start(); }}>Try again</Button>
        </Message>
      );
    case "closed":
      return <Closed reason={phase.reason} justSent={phase.justSent} copy={phase.copy} />;
    case "locked":
      return <Locked until={phase.until} busy={phase.busy} onDone={() => setPhase({ kind: "code" })} />;
    case "code":
      return <CodeEntry message={phase.message} resumed={phase.resumed} onSubmit={onCode} />;
    case "form":
      return (
        <>
          {reauth ? <CodeEntry message={reauth.message} until={reauth.until} resumed onSubmit={onCode} /> : null}
          <div hidden={!!reauth}>
            <FormView
              slug={slug}
              csrf={phase.csrf}
              form={phase.form}
              onClosed={(reason, justSent, copy) => { setReauth(null); setPhase({ kind: "closed", reason, justSent, copy }); }}
              onSessionLost={() => setReauth({})}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}

// The form is off or not set up on the server (not a connection problem).
const unavailable = (answer: { status: number; error?: { code?: string } | null }) =>
  answer.status === 503 && ["FIRM_NOT_CONFIGURED", "FIRM_NOT_AVAILABLE"].includes(answer.error?.code || "");

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h1 ref={ref} tabIndex={-1} className="text-xl font-bold text-prism-purple outline-none sm:text-2xl">{title}</h1>
      <div className="space-y-4 text-base leading-relaxed text-prism-text">{children}</div>
    </section>
  );
}

function Closed({ reason, justSent, copy }: { reason: string | null; justSent?: boolean; copy?: SentCopy }) {
  if (justSent) return <ThankYou copy={copy} />;
  if (reason === "HANDED_OVER" || reason === "TAKEN_OVER") {
    return (
      <Message title="This form is now with your enumerator">
        <p>Your GSS enumerator is completing the questionnaire with the answers you saved. Nothing you saved has been lost.</p>
        <p>If you have questions or want to change an answer, please contact your enumerator.</p>
      </Message>
    );
  }
  return (
    <Message title="This form is no longer open">
      <p>This link cannot be used any more. If you think this is a mistake, please contact your GSS enumerator.</p>
    </Message>
  );
}

function Locked({ until, busy, onDone }: { until: number; busy?: boolean; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const minutes = Math.max(1, Math.round(left / 60));
  const wait = left < 90 ? `${left} second${left === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return (
    <Message title={busy ? "Too many requests" : "Too many wrong codes"}>
      <p>{busy
        ? "We are receiving too many requests from your network at the moment."
        : "For your security, this form is locked for a while after several wrong codes."}</p>
      <p className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900" role="status" aria-live="polite">
        {left > 0 ? `Please try again in ${wait}.` : "You can try again now."}
      </p>
      {busy ? null : <p>If you have lost the code, ask your GSS enumerator for a new one.</p>}
      <Button onClick={onDone} disabled={left > 0} testId="locked-retry">{busy ? "Try again" : "Enter the code again"}</Button>
    </Message>
  );
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const formatCode = (raw: string) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
};

function CodeEntry({ message, until, resumed, onSubmit }: { message?: string; until?: number; resumed?: boolean; onSubmit: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  const wait = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  const minutes = Math.max(1, Math.round(wait / 60));
  const shown = local || (wait > 0 ? `${message} Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` : until ? "You can try again now." : message);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.replace("-", "");
    if (clean.length !== 6) { setLocal("The code has 6 characters, for example 7KQ-4MP."); return; }
    if ([...clean].some((ch) => !ALPHABET.includes(ch))) {
      setLocal("The code uses only the letters A–Z (no I, L or O) and the digits 2–9. Please check it.");
      return;
    }
    setLocal(null);
    setBusy(true);
    await onSubmit(clean);
    setBusy(false);
  };
  return (
    <Message title={resumed ? "Please enter your code again" : "Producer Price Index questionnaire"}>
      {resumed
        ? <p>Your session ended. Enter the access code again to continue; changes not yet saved will then be saved.</p>
        : (
          <>
            <p>Ghana Statistical Service has invited your business to fill in its Producer Price Index (PPI) questionnaire online.</p>
            <p>Your answers are saved as you go. You can stop at any time and continue later with the same link and code.</p>
          </>
        )}
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label htmlFor="access-code" className="block text-sm font-semibold">Access code</label>
        <p id="access-code-hint" className="text-sm text-prism-muted">6 characters, from the SMS or email you received or from your enumerator.</p>
        <input
          id="access-code"
          data-testid="access-code"
          className={`${inputClass} max-w-xs text-center font-mono text-2xl tracking-[0.3em]`}
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="XXX-XXX"
          aria-describedby={`access-code-hint${shown ? " access-code-error" : ""}`}
          aria-invalid={shown ? true : undefined}
          autoFocus
        />
        {shown ? <p id="access-code-error" role="alert" className="text-sm font-medium text-red-700">{shown}</p> : null}
        <Button type="submit" disabled={busy || wait > 0} testId="open-form">{busy ? "Checking…" : "Open the questionnaire"}</Button>
      </form>
    </Message>
  );
}

// ------------------------------------------------------------------ the questionnaire

type Step = { id: string; title: string };

function FormView({ slug, csrf, form, onClosed, onSessionLost }: {
  slug: string; csrf: string; form: FirmFormResponse;
  onClosed: (reason: string | null, justSent?: boolean, copy?: SentCopy) => void; onSessionLost: () => void;
}) {
  const f = useFirmForm({ slug, csrf, form, onClosed: (reason) => onClosed(reason), onSessionLost });
  // A new session (the code entered again): send what is waiting.
  const { resume } = f;
  const firstCsrf = useRef(csrf);
  useEffect(() => {
    if (csrf !== firstCsrf.current) { firstCsrf.current = csrf; resume(); }
  }, [csrf, resume]);

  const qt = f.doc.qt;
  const steps: Step[] = [
    { id: "general", title: "About your business" },
    { id: "revenue", title: qt === "CONSTRUCTION" ? "Revenue and construction activities" : "Revenue and product categories" },
    { id: "products", title: qt === "CONSTRUCTION" ? "Activities and contract prices" : "Products and prices" },
    ...(f.serverForm.config.productSeasonality ? [{ id: "seasonality", title: "Seasonality" }] : []),
    ...(f.serverForm.config.quarterlyRevenueRequired ? [{ id: "quarterly", title: "Quarterly revenue" }] : []),
    { id: "review", title: "Review" },
  ];
  const [step, setStep] = useState(0);
  // A pricing specification is open as a page of the products step (it has its own buttons).
  const [subpage, setSubpage] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nav = useRef<HTMLOListElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [step]);
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => heading.current?.focus(), 50);
  };
  // From the review: a step (one this questionnaire lacks falls back to the
  // products step), then the product or seasonality card in it.
  const goTo = (id: string, anchor?: string) => {
    const target = steps.findIndex((s) => s.id === id);
    go(target >= 0 ? target : steps.findIndex((s) => s.id === "products"));
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 250);
  };
  const current = steps[Math.min(step, steps.length - 1)];
  const sf = f.serverForm;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-prism-purple sm:text-2xl">{f.doc.general.establishmentName || "Your questionnaire"}</h1>
        <p className="text-sm text-prism-muted">
          {({ AGRICULTURE: "Agriculture", WHOLESALE_RETAIL: "Wholesale and retail trade", CONSTRUCTION: "Construction", OTHER: "Other sectors" } as const)[qt]} questionnaire ·
          {" "}open until {new Date(new Date(sf.invite.expiresAt).getTime() - 1).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
      </div>

      <SaveBar state={f.state} />
      {f.notice ? (
        <div role="alert" className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="flex-1">{f.notice}</p>
          <Button variant="ghost" onClick={() => f.setNotice(null)}>Dismiss</Button>
        </div>
      ) : null}

      <nav aria-label="Steps of the questionnaire">
        <ol ref={nav} className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {steps.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} data-testid={`step-${s.id}`}
                className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${i === step ? "bg-prism-purple text-white" : "bg-white text-prism-purple ring-1 ring-prism-border"}`}>
                <span className="mr-1">{i + 1}.</span>{s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <h2 ref={heading} tabIndex={-1} className="sr-only">{`Step ${step + 1} of ${steps.length}: ${current.title}`}</h2>
      {current.id === "general" ? <GeneralStep f={f} form={sf} /> : null}
      {current.id === "revenue" ? <RevenueStep f={f} form={sf} /> : null}
      {current.id === "products" ? <ProductsStep f={f} form={sf} onSubpage={setSubpage} /> : null}
      {current.id === "seasonality" ? <SeasonalityStep f={f} form={sf} /> : null}
      {current.id === "quarterly" ? <QuarterlyStep f={f} form={sf} /> : null}
      {current.id === "review" ? (
        <ReviewStep f={f} slug={slug} csrf={csrf} step={step} steps={steps.length} onBack={() => go(step - 1)}
          onSent={(copy) => onClosed("HANDED_OVER", true, copy)} onClosed={(reason) => onClosed(reason)} goTo={goTo} />
      ) : null}

      <div className={`flex flex-wrap justify-between gap-3 border-t border-prism-border pt-4 ${subpage || current.id === "review" ? "hidden" : ""}`}>
        {step > 0 ? <Button variant="secondary" onClick={() => go(step - 1)}>Back</Button> : <span />}
        {step < steps.length - 1 ? (
          <Button onClick={() => go(step + 1)} testId="next-step">Save &amp; continue <span aria-hidden="true">→</span></Button>
        ) : null}
      </div>
    </div>
  );
}

function SaveBar({ state }: { state: ReturnType<typeof useFirmForm>["state"] }) {
  const text = {
    idle: "Your answers are saved as you type.",
    saving: "Saving…",
    saved: "All changes saved.",
    retrying: "Not saved yet: no connection to the server. We keep trying; please keep this page open.",
    error: `${state.errorCount} answer${state.errorCount === 1 ? "" : "s"} could not be saved. See the messages in red.`,
  }[state.kind];
  const tone = {
    idle: "bg-white text-prism-muted", saving: "bg-white text-prism-text", saved: "bg-emerald-50 text-emerald-900",
    retrying: "bg-amber-50 text-amber-950", error: "bg-red-50 text-red-900",
  }[state.kind];
  return (
    <div className={`sticky top-0 z-10 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-prism-border ${tone}`} role="status" aria-live="polite" data-testid="save-status">
      {text}
    </div>
  );
}
