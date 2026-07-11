"use client";

type ProgressCircleProps = {
  percent: number; // 0-100 expected
  size?: number;
  strokeWidth?: number;
  colorPositive?: string;
  colorNegative?: string;
};

export function ProgressCircle({
  percent,
  size = 56,
  strokeWidth = 5,
  colorPositive = "#22c55e",
  colorNegative = "#ef4444",
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  let strokeColor = colorPositive;
  if (clamped < 50) {
    strokeColor = colorNegative;
  } else if (clamped < 80) {
    strokeColor = "#eab308"; // yellow for 50-79
  }
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          stroke="#E5E7EB"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke={strokeColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-semibold" style={{ color: strokeColor }}>
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
}
