"use client";

import { useMemo } from "react";
import { Market } from "./types";

type Supervisor = { id: string; name: string };

type MarketAssignmentTableProps = {
  markets: Market[];
  supervisors: Supervisor[];
  selectedMarketId: string | null;
  onSelectMarket: (id: string) => void;
  readOnly?: boolean;
};

export function MarketAssignmentTable({
  markets,
  supervisors,
  selectedMarketId,
  onSelectMarket,
  readOnly = false,
}: MarketAssignmentTableProps) {
  const supervisorLookup = useMemo(
    () =>
      supervisors.reduce<Record<string, Supervisor>>((acc, sup) => {
        acc[sup.id] = sup;
        return acc;
      }, {}),
    [supervisors]
  );

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-extrabold text-prism-text">Market Assignments</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
            <tr>
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Supervisor</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => {
              const supervisorName = m.supervisorId
                ? supervisorLookup[m.supervisorId]?.name ?? "Unknown"
                : "";
              const label = supervisorName ? "Edit" : "Assign";
              return (
                <tr
                  key={m.id}
                  className="border-b border-prism-border/50 last:border-b-0"
                >
                  <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                    {m.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                    {m.district}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-prism-text">
                    {supervisorName || "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onSelectMarket(m.id)}
                      className={`rounded-full px-4 py-1 text-xs font-semibold shadow-sm transition ${
                        readOnly
                          ? "cursor-not-allowed bg-prism-border text-prism-muted"
                          : "bg-[#221B51] text-white hover:brightness-110"
                      } ${selectedMarketId === m.id ? "ring-2 ring-[#221B51]/40" : ""}`}
                    >
                      {label}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
