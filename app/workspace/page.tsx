"use client";

// app/workspace/page.tsx
// After sign-in, users who work in both programmes (HQ/Admin) choose CPI or
// PPI here. Everyone else never sees it: they are sent to their programme.
// Market Initiation is finished and not offered here; it stays in the top-bar
// module selector.
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthActions } from "@/hooks/useAuthActions";
import type { DashboardUser } from "@/lib/auth";
import { loadDashboardUser } from "@/lib/dashboard-user-client";
import { DashboardModule, lastDashboardModule, MODULE_HOME, MODULE_LABEL, setDashboardModule } from "@/lib/module-store";
import { landingFor, programsOf } from "@/lib/programs";

const roleLabel = (role: DashboardUser["role"]) => (role === "HQ" ? "HQ" : role.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));

function BasketIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-16 sm:w-16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 18 22 8M32 18 26 8" />
      <path d="M6 18h36l-4 20a4 4 0 0 1-4 3H14a4 4 0 0 1-4-3L6 18Z" />
      <path d="M18 26v8M24 26v8M30 26v8" />
    </svg>
  );
}

function FactoryIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-16 sm:w-16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 42V24l10 6v-6l10 6V8h8v34H6Z" />
      <path d="M13 35h3M21 35h3M29 35h3" strokeLinecap="round" />
    </svg>
  );
}

function WorkspaceCard({ code, title, description, icon, tint, modules, onOpen }: {
  code: string; title: string; description: string; icon: React.ReactNode; tint: string;
  modules: DashboardModule[]; onOpen: (module: DashboardModule) => void;
}) {
  return (
    <article className="flex flex-col rounded-3xl border border-prism-border bg-white p-6 shadow-sm sm:p-10">
      <div className="flex items-start gap-5 sm:gap-7">
        <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl sm:h-28 sm:w-28 ${tint}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-prism-muted">{code}</p>
          <h2 className="mt-1 text-xl font-black text-prism-text sm:text-2xl">{title}</h2>
          <p className="mt-2 text-sm text-prism-muted sm:text-base">{description}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
        {modules.map((module) => (
          <button key={module} type="button" onClick={() => onOpen(module)}
            className="rounded-xl border border-prism-border bg-white px-6 py-2.5 text-sm font-bold text-prism-text hover:border-prism-purple/40 hover:bg-prism-bg/60">
            {MODULE_LABEL[module]}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onOpen(modules[0])}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-prism-purple px-6 py-4 text-base font-bold text-white hover:bg-prism-purple-dark sm:mt-10">
        Open {code} <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export default function WorkspacePage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const [user, setUser] = useState<DashboardUser | null>(null);

  useEffect(() => {
    let active = true;
    loadDashboardUser()
      .then((loaded) => {
        if (!active) return;
        // One programme only: nothing to choose.
        if (programsOf(loaded).length < 2) {
          const landing = landingFor(loaded, lastDashboardModule());
          if (landing.module) setDashboardModule(landing.module);
          router.replace(landing.path);
          return;
        }
        setUser(loaded);
      })
      .catch(() => { if (active) signOut(); });
    return () => { active = false; };
  }, [router, signOut]);

  const open = (module: DashboardModule) => {
    setDashboardModule(module);
    router.push(MODULE_HOME[module]);
  };

  return (
    <main className="flex min-h-screen flex-col bg-prism-bg">
      <header className="flex items-center justify-between gap-4 bg-white px-4 py-3 shadow-sm sm:px-12">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
            <Image src="/Prism-logo-ui.png" alt="PRISM-Ghana logo" fill sizes="64px" className="object-contain" priority />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-prism-muted">PRICE INDEX</span>
            <span className="text-lg font-extrabold tracking-tight text-prism-purple sm:text-xl">PRISM-GHANA</span>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 sm:h-12 sm:w-12">
              <Image src="/user-avatar-ui.png" alt="" fill sizes="48px" className="rounded-full object-cover" />
            </div>
            <div className="hidden border-l border-prism-border pl-3 leading-tight sm:block">
              <p className="font-bold text-prism-text">{user.full_name}</p>
              <p className="text-sm text-prism-muted">{roleLabel(user.role)}</p>
            </div>
          </div>
        )}
      </header>

      <section className="flex flex-1 flex-col items-center px-4 py-12 sm:px-12 sm:py-20">
        <h1 className="text-center text-3xl font-black tracking-tight text-prism-text sm:text-5xl">Choose a workspace</h1>
        <p className="mt-3 text-center text-base text-prism-muted sm:text-lg">Select the price index you want to work on.</p>
        {user ? (
          <div className="mt-10 grid w-full max-w-6xl gap-6 md:grid-cols-2 sm:mt-14">
            <WorkspaceCard code="CPI" title="Consumer Price Index" description="Collect and review consumer prices across markets."
              icon={<BasketIcon />} tint="bg-prism-teal/15 text-prism-teal" modules={["reading"]} onOpen={open} />
            <WorkspaceCard code="PPI" title="Producer Price Index" description="Set up producer price collection and review establishment submissions."
              icon={<FactoryIcon />} tint="bg-violet-100 text-prism-purple" modules={["ppi"]} onOpen={open} />
          </div>
        ) : (
          <p className="mt-14 text-sm text-prism-muted" role="status">Loading your workspaces…</p>
        )}
      </section>

      <footer className="pb-8 text-center text-sm text-prism-muted">Ghana Statistical Service</footer>
    </main>
  );
}
