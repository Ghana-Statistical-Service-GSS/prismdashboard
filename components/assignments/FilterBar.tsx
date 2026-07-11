"use client";

import { ReactNode } from "react";

type FilterBarProps = {
  leftLabel: string;
  rightContent: ReactNode;
  className?: string;
};

export function FilterBar({ leftLabel, rightContent, className }: FilterBarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl bg-white px-6 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-prism-text">
        {leftLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">{rightContent}</div>
    </div>
  );
}
