"use client";

import { useEffect, useState } from "react";

// Search box for dashboard tables. onChange fires once typing pauses
// (delayMs), so a server-side search is not sent on every keystroke.
export function TableSearch({ value, onChange, placeholder, delayMs = 300, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  delayMs?: number;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, value, delayMs, onChange]);
  return (
    <div className={`relative ${className}`}>
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-prism-border bg-white px-3 py-2 pr-8 text-sm text-prism-text focus:border-prism-purple focus:outline-none focus:ring-2 focus:ring-prism-purple/20"
      />
      {text && (
        <button type="button" onClick={() => { setText(""); onChange(""); }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-base font-bold leading-none text-prism-muted hover:text-prism-text">×</button>
      )}
    </div>
  );
}
