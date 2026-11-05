import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { dashboardBackendRequest, readBackendResponse } from "@/lib/backend";
import { programsOf, type Program } from "@/lib/programs";

const SCOPED_ROLE_RESTRICTED_PATHS = [
  "/sms",
  "/email-alerts",
  "/validation",
  "/threshold-exception",
  "/missing-prices",
];
const HQ_ONLY_PATHS = [
  "/collection-calendar",
  "/assignments",
  "/market-reading/devices",
  "/regions",
  "/districts",
  "/markets",
  "/outlets",
  "/items",
  "/staff",
];
// Administrators only (not HQ): PPI accounts and phone rebinding.
const ADMIN_ONLY_PATHS = ["/ppi/users", "/ppi/devices"];

function isScopedRoleRestrictedPath(pathname: string) {
  return SCOPED_ROLE_RESTRICTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
function isHqOnlyPath(pathname: string) {
  return HQ_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
function isPpiPath(pathname: string) {
  return pathname === "/ppi" || pathname.startsWith("/ppi/");
}

// Where a refused page sends the user: the PPI dashboard for a PPI page,
// otherwise the Market Initiation dashboard (as before).
function deniedHome(pathname: string) {
  return pathname === "/ppi" || pathname.startsWith("/ppi/") ? "/ppi/dashboard" : "/dashboard";
}

// Where the dashboard opens: the module chosen in the top bar (cookie set by
// lib/module-store), Market Reading by default.
function moduleHome(request: NextRequest) {
  const chosen = request.cookies.get("prism_module")?.value;
  return chosen === "initiation" ? "/dashboard" : chosen === "ppi" ? "/ppi/dashboard" : "/dashboard/market-reading";
}

// The role and programme check before restricted pages asked the backend on
// every navigation. It is remembered per session token for a minute; the
// backend still enforces every rule on the data itself.
const ROLE_CACHE_MS = 60_000;
type Session = { role: string | undefined; programs: Program[] };
const sessions = new Map<string, { session: Session; expires: number }>();
async function sessionFor(token: string): Promise<Session> {
  const cached = sessions.get(token);
  if (cached && cached.expires > Date.now()) return cached.session;
  const response = await dashboardBackendRequest("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const body = await readBackendResponse(response);
  const user = body?.user;
  const session: Session = { role: user?.role, programs: user?.role ? programsOf(user) : [] };
  if (sessions.size > 500) sessions.clear();
  sessions.set(token, { session, expires: Date.now() + ROLE_CACHE_MS });
  return session;
}

// The firm's public web form (/f/<link>): no dashboard session, its own
// access code and API (/api/firm, outside this matcher).
function isPublicFirmPath(pathname: string) {
  return pathname === "/f" || pathname.startsWith("/f/");
}

export async function proxy(request: NextRequest) {
  if (isPublicFirmPath(request.nextUrl.pathname)) return NextResponse.next();
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/";

  if (!signedIn && !isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL(moduleHome(request), request.url));
  }

  const pathname = request.nextUrl.pathname;
  if (signedIn && (isScopedRoleRestrictedPath(pathname) || isHqOnlyPath(pathname) || isAdminOnlyPath(pathname) || isPpiPath(pathname))) {
    try {
      const token = request.cookies.get(SESSION_COOKIE)?.value || "";
      const { role, programs } = await sessionFor(token);
      // A PPI page for someone who does not work in PPI (e.g. a CPI-only HQ
      // account): back to CPI Market Reading.
      if (isPpiPath(pathname) && !programs.includes("PPI")) {
        return NextResponse.redirect(new URL("/dashboard/market-reading", request.url));
      }
      const denied = (isScopedRoleRestrictedPath(pathname) && (role === "REGIONAL_STATISTICIAN" || role === "SUPERVISOR"))
        || (isHqOnlyPath(pathname) && role !== "HQ" && role !== "ADMIN")
        || (isAdminOnlyPath(pathname) && role !== "ADMIN");
      if (denied) {
        return NextResponse.redirect(new URL(deniedHome(pathname), request.url));
      }
    } catch {
      return NextResponse.redirect(new URL(deniedHome(pathname), request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
