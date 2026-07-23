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

export async function proxy(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/";

  if (!signedIn && !isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (signedIn && (isScopedRoleRestrictedPath(request.nextUrl.pathname) || isHqOnlyPath(request.nextUrl.pathname))) {
    try {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const response = await dashboardBackendRequest("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readBackendResponse(response);
      const role = body?.user?.role;
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
