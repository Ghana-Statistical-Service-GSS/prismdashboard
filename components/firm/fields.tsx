"use client";

// Form controls of the firm's web form: labelled, 44px touch targets, the
// server's message under the field it is about.
import { useId } from "react";
import type { Amount, Coded, FieldError, Option, QuestionnaireType } from "./types";

export const inputClass =
  "block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-prism-text shadow-sm focus:border-prism-purple focus:outline-none focus:ring-2 focus:ring-prism-purple/30 aria-[invalid=true]:border-red-600";

// The message of the first server error whose field starts with `prefix`.
export function errorFor(errors: FieldError[] | undefined, ...prefixes: string[]) {
  if (!errors?.length) return undefined;
  const hit = errors.find((e) => prefixes.some((p) => e.field === p || e.field.startsWith(`${p}.`)));
  return hit ? humanise(hit.message) : undefined;
}

// The server errors no field on the page shows (they are listed together, so
// none is lost): `shown` are the field prefixes the page puts under inputs.
export function otherErrors(errors: FieldError[] | undefined, shown: string[]) {
  return (errors || []).filter((e) => !shown.some((p) => e.field === p || e.field.startsWith(`${p}.`)));
}

const humanise = (message: string) => {
  const m = message.replace(/^must be /, "Must be ");
  return m.charAt(0).toUpperCase() + m.slice(1);
};

function Shell({ id, label, hint, error, children, optional }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-prism-text">
        {label}
        {optional ? <span className="ml-1 font-normal text-prism-muted">(optional)</span> : null}
      </label>
      {hint ? <p id={`${id}-hint`} className="text-sm text-prism-muted">{hint}</p> : null}
      {children}
      {error ? <p id={`${id}-error`} className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

export function TextField({ label, value, onChange, onBlur, hint, error, optional, multiline, placeholder, inputMode, type = "text", autoComplete, testId }: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; hint?: string; error?: string; optional?: boolean;
  multiline?: boolean; placeholder?: string; inputMode?: "decimal" | "numeric" | "tel" | "email" | "text"; type?: string; autoComplete?: string; testId?: string;
}) {
  const id = useId();
  const common = {
    id, value, placeholder, onBlur, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy(id, hint, error),
    "data-testid": testId, className: inputClass,
  };
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      {multiline
        ? <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
        : <input {...common} type={type} inputMode={inputMode} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />}
    </Shell>
  );
}

export function NumberField(props: Omit<Parameters<typeof TextField>[0], "inputMode"> & { prefix?: string }) {
  return <TextField {...props} inputMode="decimal" />;
}

export function SelectField({ label, value, options, onChange, hint, error, optional, placeholder = "Choose…", testId }: {
  label: string; value: string | null; options: { code: string; label: string }[]; onChange: (v: string | null) => void;
  hint?: string; error?: string; optional?: boolean; placeholder?: string; testId?: string;
}) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        value={value ?? ""}
        data-testid={testId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
    </Shell>
  );
}

// A code list answer; "Other (specify)" asks for the text.
export function CodedField({ label, value, options, qt, onChange, onBlur, hint, error, optional, testId }: {
  label: string; value: Coded; options: Option[]; qt: QuestionnaireType; onChange: (v: Coded) => void; onBlur?: () => void;
  hint?: string; error?: string; optional?: boolean; testId?: string;
}) {
  const offered = options.filter((o) => !o.only || o.only.includes(qt));
  return (
    <div className="space-y-3">
      <SelectField label={label} value={value.code} options={offered} hint={hint} error={error} optional={optional} testId={testId}
        onChange={(code) => onChange({ code, otherText: code === "OTHER" ? value.otherText : "" })} />
      {value.code === "OTHER" ? (
        <TextField label={`${label}: please specify`} value={value.otherText} onBlur={onBlur} onChange={(otherText) => onChange({ ...value, otherText })} />
      ) : null}
    </div>
  );
}

export function YesNo({ label, value, onChange, hint, error, testId }: { label: string; value: boolean | null; onChange: (v: boolean) => void; hint?: string; error?: string; testId?: string }) {
  const name = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-semibold text-prism-text">{label}</legend>
      {hint ? <p className="text-sm text-prism-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
          <label key={l} className={`flex min-h-11 min-w-20 cursor-pointer items-center gap-2 rounded-xl border px-4 text-base ${value === v ? "border-prism-purple bg-prism-purple/5 font-semibold" : "border-gray-300 bg-white"}`}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="h-5 w-5 accent-prism-purple" data-testid={testId ? `${testId}-${l.toLowerCase()}` : undefined} />
            {l}
          </label>
        ))}
      </div>
      {error ? <p id={`${name}-error`} className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </fieldset>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function MonthsField({ label, value, onChange, error }: { label: string; value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const toggle = (m: number) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-prism-text">{label}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MONTHS.map((m, i) => (
          <label key={m} className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-sm ${value.includes(i + 1) ? "border-prism-purple bg-prism-purple/5 font-semibold" : "border-gray-300 bg-white"}`}>
            <input type="checkbox" checked={value.includes(i + 1)} onChange={() => toggle(i + 1)} className="h-4 w-4 accent-prism-purple" aria-label={MONTHS_LONG[i]} />
            {m}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </fieldset>
  );
}

export function CheckboxField({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-prism-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-prism-purple" data-testid={testId} />
      {label}
    </label>
  );
}

// An amount, optionally "not available" (late months and quarters).
export function AmountField({ label, value, onChange, onBlur, allowNotAvailable, error, hint, testId }: {
  label: string; value: Amount; onChange: (v: Amount) => void; onBlur?: () => void; allowNotAvailable?: boolean; error?: string; hint?: string; testId?: string;
}) {
  const na = value.state === "NOT_AVAILABLE";
  return (
    <div className="space-y-1">
      {na ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-prism-text">{label}</p>
          <p className="min-h-11 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-prism-muted">Not available</p>
        </div>
      ) : (
        <NumberField label={label} hint={hint} error={error} testId={testId} onBlur={onBlur}
          value={value.state === "REPORTED" ? String(value.amount ?? "") : ""}
          onChange={(v) => onChange(v.trim() === "" ? { state: "NOT_RECORDED" } : { state: "REPORTED", amount: v })} />
      )}
      {allowNotAvailable ? (
        <CheckboxField label="Not available yet" checked={na} testId={testId ? `${testId}-na` : undefined}
          onChange={(c) => onChange(c ? { state: "NOT_AVAILABLE" } : { state: "NOT_RECORDED" })} />
      ) : null}
      {na && error ? <p className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

export function Card({ title, children, status, actions, level = 3 }: { title: string; children: React.ReactNode; status?: React.ReactNode; actions?: React.ReactNode; level?: 2 | 3 | 4 }) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <section className="space-y-4 rounded-2xl border border-prism-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="text-base font-bold text-prism-purple sm:text-lg">{title}</Heading>
        <div className="flex items-center gap-2">{status}{actions}</div>
      </div>
      {children}
    </section>
  );
}

export function Button({ children, onClick, variant = "primary", type = "button", disabled, testId, className = "", label }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost"; type?: "button" | "submit";
  disabled?: boolean; testId?: string; className?: string; label?: string;
}) {
  const styles = {
    primary: "bg-prism-purple text-white hover:bg-prism-purple-dark",
    secondary: "border border-prism-purple bg-white text-prism-purple hover:bg-prism-purple/5",
    danger: "border border-red-700 bg-white text-red-700 hover:bg-red-50",
    ghost: "text-prism-purple underline-offset-2 hover:underline",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} aria-label={label}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-prism-purple/50 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  );
}

// "Saving…" / "Saved" / "Not saved" next to a record.
export function RecordStatus({ pending, error }: { pending: boolean; error?: string }) {
  if (error) return <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">Not saved</span>;
  if (pending) return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">Saving…</span>;
  return null;
}
