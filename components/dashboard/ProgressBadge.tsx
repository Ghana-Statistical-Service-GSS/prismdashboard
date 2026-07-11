// components/dashboard/ProgressBadge.tsx
type ProgressBadgeProps = {
  label: string;
  value: string;
  percent: number;
};

export function ProgressBadge({ label, value, percent }: ProgressBadgeProps) {
  return (
    <div className="flex flex-col justify-between rounded-3xl bg-white px-6 py-5 shadow-md">
      <p className="mb-4 text-xs font-medium text-prism-muted">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-semibold">
          <span className="text-prism-text">{value.split("/")[0]}</span>
          <span className="text-prism-muted">/{value.split("/")[1]}</span>
        </p>

        {/* fake circular progress */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-[6px] border-prism-bg" />
          <div
            className="absolute inset-0 rounded-full border-[6px] border-prism-purple border-t-prism-teal border-l-prism-teal"
            style={{ transform: "rotate(45deg)" }}
          />
          <div className="absolute inset-1 flex items-center justify-center rounded-full bg-white text-[11px] font-semibold text-prism-teal">
            {percent}%
          </div>
        </div>
      </div>
    </div>
  );
}
