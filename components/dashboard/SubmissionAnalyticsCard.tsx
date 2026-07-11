"use client";

// components/dashboard/SubmissionAnalyticsCard.tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { region: "Western", value: 82 },
  { region: "Central", value: 75 },
  { region: "Greater Accra", value: 93 },
  { region: "Volta", value: 68 },
  { region: "Eastern", value: 80 },
  { region: "Ashanti", value: 88 },
  { region: "Western North", value: 71 },
  { region: "Ahafo", value: 77 },
  { region: "Bono", value: 84 },
  { region: "Bono East", value: 79 },
  { region: "Oti", value: 65 },
  { region: "Northern", value: 86 },
  { region: "Savannah", value: 72 },
  { region: "North East", value: 69 },
  { region: "Upper East", value: 81 },
  { region: "Upper West", value: 74 },
];

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; payload: { region: string } }>;
};

const ChartTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;

  const { region } = payload[0].payload;
  const value = payload[0].value;

  return (
    <div className="rounded-md border border-prism-border bg-white px-3 py-2 text-xs text-prism-text shadow-sm">
      <p className="font-semibold">{region}</p>
      <p className="text-prism-muted">Submission Rate: {value}%</p>
    </div>
  );
};

export function SubmissionAnalyticsCard() {
  return (
    <section className="mt-10 rounded-3xl bg-white p-6 shadow-md">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-prism-text">
            Submission Analytics
          </p>
          <p className="text-xs text-prism-muted">
            Monthly Submission Rate by Region
          </p>
        </div>
        <p className="text-xs text-prism-muted">2021 ▾</p>
      </header>

      <div className="h-64 rounded-2xl bg-gradient-to-r from-prism-teal-soft/20 via-white to-prism-purple/10 border border-prism-border/60 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="region"
              tick={{ fontSize: 10, fill: "#6B7280" }}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#6B7280" }}
              label={{
                value: "Completion (%)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                fill: "#6B7280",
                fontSize: 10,
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" fill="#2D205C" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
