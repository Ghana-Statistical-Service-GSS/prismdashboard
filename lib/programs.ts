import type { DashboardUser } from "@/lib/auth";
import type { DashboardModule } from "@/lib/module-store";

// The statistics programmes a dashboard user works in. The backend sends
// them with the user (HQ/Admin: both; Supervisors and Regional Statisticians:
// their own). A backend that does not send them yet is read the same way,
// with everyone below HQ in CPI.
export type Program = "CPI" | "PPI";

export const MODULE_PROGRAM: Record<DashboardModule, Program> = { reading: "CPI", initiation: "CPI", ppi: "PPI" };

export const WORKSPACE_PATH = "/workspace";

export function programsOf(user: Pick<DashboardUser, "role" | "program" | "programs">): Program[] {
  if (user.programs?.length) return user.programs;
  if (user.role === "HQ" || user.role === "ADMIN") return ["CPI", "PPI"];
  return [user.program ?? "CPI"];
}

// Where a user lands after signing in: the workspace chooser when they work in
// both programmes, otherwise their programme's module (for CPI, the one last
// chosen in the top bar: Market Reading unless it was Market Initiation).
export function landingFor(user: Pick<DashboardUser, "role" | "program" | "programs">, lastModule: DashboardModule | null): { path: string; module: DashboardModule | null } {
  const programs = programsOf(user);
  if (programs.length > 1) return { path: WORKSPACE_PATH, module: null };
  if (programs[0] === "PPI") return { path: "/ppi/dashboard", module: "ppi" };
  return lastModule === "initiation"
    ? { path: "/dashboard", module: "initiation" }
    : { path: "/dashboard/market-reading", module: "reading" };
}
