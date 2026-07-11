"use client";

import { Outlet } from "./types";

type OutletAssignmentTableProps = {
  outlets: Outlet[];
  readOnly?: boolean;
  onAssignClick: (outlet: Outlet) => void;
};

export function OutletAssignmentTable({
  outlets,
  readOnly = false,
  onAssignClick,
}: OutletAssignmentTableProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-extrabold text-prism-text">Outlet Assignments</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
            <tr>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">Current Reader(s)</th>
              <th className="px-4 py-3 text-center">Assigned Items</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const hasReaders = (o.readerIds?.length ?? 0) > 0;
              const label = hasReaders ? "Edit" : "Assign";
              return (
                <tr key={o.id} className="border-b border-prism-border/50 last:border-b-0">
                  <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                    {o.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                    {o.category}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                    {o.marketId}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-prism-text">
                    {o.readerIds?.length ? o.readerIds.join(", ") : "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-prism-text">
                    {"—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onAssignClick(o)}
                      className={`rounded-full px-4 py-1 text-xs font-semibold shadow-sm transition ${
                        readOnly
                          ? "cursor-not-allowed bg-prism-border text-prism-muted"
                          : "bg-[#221B51] text-white hover:brightness-110"
                      }`}
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
