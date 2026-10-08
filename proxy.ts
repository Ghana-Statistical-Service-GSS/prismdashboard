import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

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
  "/regions",
  "/districts",
  "/markets",
  "/outlets",
  "/items",
  "/staff",
];

function isScopedRoleRestrictedPath(pathname: string) {
  return SCOPED_ROLE_RESTRICTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
function isHqOnlyPath(pathname: string) {
  return HQ_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Where the dashboard opens: the module chosen in the top bar (cookie set by
// lib/module-store), Market Reading by default.
function moduleHome(request: NextRequest) {
  return request.cookies.get("prism_module")?.value === "initiation" ? "/dashboard" : "/dashboard/market-reading";
}

// The role check before restricted pages asked the backend on every
// navigation. It is remembered per session token for a minute; the backend
// still enforces every rule on the data itself.
const ROLE_CACHE_MS = 60_000;
const roles = new Map<string, { role: string | undefined; expires: number }>();
async function roleFor(token: string) {
  const cached = roles.get(token);
  if (cached && cached.expires > Date.now()) return cached.role;
  const response = await dashboardBackendRequest("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const body = await readBackendResponse(response);
  const role: string | undefined = body?.user?.role;
  if (roles.size > 500) roles.clear();
  roles.set(token, { role, expires: Date.now() + ROLE_CACHE_MS });
  return role;
}

export async function proxy(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/";

  if (!signedIn && !isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL(moduleHome(request), request.url));
  }

  if (signedIn && (isScopedRoleRestrictedPath(request.nextUrl.pathname) || isHqOnlyPath(request.nextUrl.pathname))) {
    try {
      const token = request.cookies.get(SESSION_COOKIE)?.value || "";
      const role = await roleFor(token);
      const denied = (isScopedRoleRestrictedPath(request.nextUrl.pathname) && (role === "REGIONAL_STATISTICIAN" || role === "SUPERVISOR"))
        || (isHqOnlyPath(request.nextUrl.pathname) && role !== "HQ" && role !== "ADMIN");
      if (denied) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
