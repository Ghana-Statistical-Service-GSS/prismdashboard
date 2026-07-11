// components/dashboard/StatCardRow.tsx
import { ProgressBadge } from "./ProgressBadge";

export function StatCardRow() {
  const stats = [
    { label: "Total Regions", value: "6/10", percent: 25 },
    { label: "Total Districts", value: "90/150", percent: 45 },
    { label: "Total Markets", value: "90/150", percent: 90 },
    { label: "Total Outlets", value: "90/900", percent: 25 },
  ];

  return (
    <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => (
        <ProgressBadge
          key={s.label}
          label={s.label}
          value={s.value}
          percent={s.percent}
        />
      ))}
    </section>
  );
}



