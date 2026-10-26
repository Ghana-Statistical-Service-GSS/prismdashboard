"use client";

import { use } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SubmissionReview } from "@/components/ppi/SubmissionReview";

// PPI › Review › one submitted version.
export default function PpiSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = use(params);
  return (
    <div className="flex min-h-screen bg-prism-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8 xl:px-10">
          <SubmissionReview key={submissionId} submissionId={submissionId} />
        </main>
      </div>
    </div>
  );
}
