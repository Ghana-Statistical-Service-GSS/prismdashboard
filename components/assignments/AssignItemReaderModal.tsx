"use client";

import { useState } from "react";

type ItemRow = {
  id: number;
  name: string;
  brand: string;
};

type AssignItemReaderModalProps = {
  open: boolean;
  item: ItemRow | null;
  onClose: () => void;
  onSave: (itemId: number, readers: string[]) => void;
  role?: "HQ" | "RS" | "Supervisor";
};

const readers = ["READER A", "READER B", "READER C", "READER D"];

export function AssignItemReaderModal({
  open,
  item,
  onClose,
  onSave,
  role = "HQ",
}: AssignItemReaderModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  if (!open || !item) return null;

  const close = () => {
    setSelected([]);
    onClose();
  };

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const isSupervisor = role === "Supervisor";
  const options = isSupervisor ? readers.slice(0, 2) : readers;

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
              Assign Market Readers – {item.name}
            </h3>
            <p className="text-xs text-prism-muted">Brand/Category: {item.brand}</p>
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
          <div className="flex flex-col gap-2">
            {options.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-prism-text">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selected.includes(r)}
                  onChange={() => toggle(r)}
                />
                {r}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              onSave(item.id, selected);
              close();
            }}
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
