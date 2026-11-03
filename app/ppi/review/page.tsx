"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ReviewQueue } from "@/components/ppi/ReviewQueue";

// PPI › Review queue.
export default function PpiReviewQueuePage() {
  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <ReviewQueue />
        </main>
      </div>
    </div>
  );
}
