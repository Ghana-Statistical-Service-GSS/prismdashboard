"use client";

import Image from "next/image";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AssignmentsTabs } from "@/components/assignments/AssignmentsTabs";

type TabKey = "region" | "markets" | "outlets";

export default function AssignmentsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("markets");

  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-10 py-8">
          {/* Header */}
          <header className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-prism-text">
                ASSIGNMENTS
              </h1>
              <p className="mt-2 text-sm text-prism-muted">
                Manage who is responsible for markets, outlets and items.
              </p>
            </div>
            <div className="relative h-32 w-56 md:h-40 md:w-64">
              <Image
                src="/officer-avatar.png"
                alt="Assignments"
                fill
                className="object-contain"
                priority
              />
            </div>
          </header>

          <AssignmentsTabs active={activeTab} onChange={setActiveTab} />
        </main>
      </div>
    </div>
  );
}
