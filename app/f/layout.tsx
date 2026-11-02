import type { Metadata } from "next";
import Image from "next/image";

// The firm's public web form: its own minimal layout (no dashboard sidebar
// or session), never indexed.
export const metadata: Metadata = {
  title: "PPI questionnaire | Ghana Statistical Service",
  description: "Producer Price Index questionnaire for establishments invited by Ghana Statistical Service.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function FirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-prism-bg">
      <header className="border-b border-prism-border bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Image src="/gss-logo-ui.png" alt="Ghana Statistical Service" width={40} height={40} priority />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-prism-purple">Ghana Statistical Service</p>
            <p className="text-xs leading-tight text-prism-muted">Producer Price Index (PPI) survey</p>
          </div>
          <Image src="/Prism-logo-ui.png" alt="PRISM" width={36} height={36} className="rounded-lg" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:py-8">{children}</main>
      <footer className="border-t border-prism-border bg-white">
        <p className="mx-auto max-w-4xl px-4 py-4 text-xs text-prism-muted">
          Your answers are confidential and used only for official statistics.
        </p>
      </footer>
    </div>
  );
}
