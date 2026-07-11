"use client";

import { useState } from "react";
import { Market } from "./types";

type AssignSupervisorDrawerProps = {
  selectedMarket: Market | null;
  open: boolean;
  onClose: () => void;
  onSave: (marketId: string, supervisorId?: string) => void;
  role?: "HQ" | "RS" | "Supervisor";
};

const dummySupervisors = [
  { id: "sup-a", name: "SUPERVISOR A" },
  { id: "sup-b", name: "SUPERVISOR B" },
  { id: "sup-c", name: "SUPERVISOR C" },
];

export function AssignSupervisorDrawer({
  selectedMarket,
  open,
  onClose,
  onSave,
  role = "HQ",
}: AssignSupervisorDrawerProps) {
  const [value, setValue] = useState<string>(selectedMarket?.supervisorId ?? "");

  if (!open || !selectedMarket) return null;

  const readOnly = role === "Supervisor";

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-md md:sticky md:top-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-extrabold text-prism-text">
            Assign Supervisor – {selectedMarket.name}
          </h4>
          <p className="text-xs text-prism-muted">Region: {selectedMarket.region}</p>
          <p className="text-xs text-prism-muted">District: {selectedMarket.district}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-prism-muted">
          Supervisor (one per market)
        </label>
        <select
          disabled={readOnly}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30 disabled:cursor-not-allowed"
        >
          <option value="">Select Supervisor</option>
          {dummySupervisors.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
        </select>
      </div>

      {readOnly ? (
        <p className="mt-4 text-xs text-prism-muted">
          You have read-only access. Contact HQ/RS to modify assignments.
        </p>
      ) : (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              onSave(selectedMarket.id, value || undefined);
              onClose();
            }}
            className="rounded-full bg-[#221B51] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Save Assignment
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-prism-border px-4 py-2 text-xs font-semibold text-prism-text transition hover:bg-prism-bg"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
