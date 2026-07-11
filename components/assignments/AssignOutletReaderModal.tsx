"use client";

import { useState } from "react";
import { Outlet } from "./types";

type AssignOutletReaderModalProps = {
  open: boolean;
  outlet: Outlet | null;
  onClose: () => void;
  onSave: (outletId: string, readers: string[]) => void;
  role?: "HQ" | "RS" | "Supervisor";
};

const readers = [
  { id: "reader-a", name: "READER A" },
  { id: "reader-b", name: "READER B" },
  { id: "reader-c", name: "READER C" },
  { id: "reader-d", name: "READER D" },
];

export function AssignOutletReaderModal({
  open,
  outlet,
  onClose,
  onSave,
  role = "HQ",
}: AssignOutletReaderModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [singleReader, setSingleReader] = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!open || !outlet) return null;

  const close = () => {
    setSelected([]);
    setSingleReader("");
    setError("");
    onClose();
  };

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const isSupervisor = role === "Supervisor";
  const options = isSupervisor ? readers.slice(0, 2) : readers;
  const isLarge = outlet.category === "Large";

  const handleSave = () => {
    if (isLarge) {
      onSave(outlet.id, selected);
      close();
      return;
    }

    // Business rule: Small/Medium -> only one reader
    if (!singleReader) {
      setError("Select one Market Reader for this outlet.");
      return;
    }
    setError("");
    onSave(outlet.id, [singleReader]);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-prism-text">
              Assign Market Readers – {outlet.name}
            </h3>
            <p className="text-xs text-prism-muted">Market: {outlet.marketId}</p>
            <p className="text-xs text-prism-muted">Region: {outlet.region}</p>
            <p className="text-xs font-semibold text-prism-text">
              Category: {outlet.category}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="h-9 w-9 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-prism-muted">
            Market Readers
          </label>
          {isLarge ? (
            <div className="flex flex-col gap-2">
              {options.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm text-prism-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selected.includes(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          ) : (
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              value={singleReader}
              onChange={(e) => setSingleReader(e.target.value)}
            >
              <option value="">Select Market Reader</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-[#221B51] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Save Assignment
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-prism-border px-4 py-2 text-xs font-semibold text-prism-text transition hover:bg-prism-bg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
