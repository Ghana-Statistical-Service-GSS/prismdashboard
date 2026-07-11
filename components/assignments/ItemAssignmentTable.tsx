"use client";

type ItemRow = {
  id: number;
  name: string;
  brand: string;
  readers: string[];
};

type ItemAssignmentTableProps = {
  items: ItemRow[];
  readOnly?: boolean;
  onAssignClick: (item: ItemRow) => void;
};

export function ItemAssignmentTable({
  items,
  readOnly = false,
  onAssignClick,
}: ItemAssignmentTableProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-extrabold text-prism-text">Item Assignments</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-prism-border/70 text-[11px] uppercase tracking-[0.2em] text-prism-muted">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Brand / Category</th>
              <th className="px-4 py-3">Assigned Reader(s)</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-prism-border/50 last:border-b-0">
                <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-sm font-semibold uppercase text-prism-text">
                  {item.brand}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-prism-text">
                  {item.readers.join(", ") || "Unassigned"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onAssignClick(item)}
                    className={`rounded-full px-4 py-1 text-xs font-semibold shadow-sm transition ${
                      readOnly
                        ? "cursor-not-allowed bg-prism-border text-prism-muted"
                        : "bg-[#221B51] text-white hover:brightness-110"
                    }`}
                  >
                    Assign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
