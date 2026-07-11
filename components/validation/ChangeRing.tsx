"use client";

type ChangeRingProps = {
  percent: number;
};

export function ChangeRing({ percent }: ChangeRingProps) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(Math.abs(percent), 0), 100);
  const offset = circumference - (clamped / 100) * circumference;
  const positive = percent >= 0;
  const strokeColor = positive ? "#14B8A6" : "#EF4444"; // teal vs red

  return (
    <div className="relative h-12 w-12">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle
          className="text-prism-border"
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          r={radius}
          cx="24"
          cy="24"
        />
        <circle
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx="24"
          cy="24"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-semibold" style={{ color: strokeColor }}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}
