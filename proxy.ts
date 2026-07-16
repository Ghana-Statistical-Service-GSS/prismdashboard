import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

const RS_RESTRICTED_PATHS = [
  "/sms",
  "/regions",
  "/districts",
  "/markets",
  "/outlets",
  "/items",
  "/staff",
  "/validation",
  "/threshold-exception",
  "/missing-prices",
];

function isRsRestrictedPath(pathname: string) {
  return RS_RESTRICTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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

  if (signedIn && isRsRestrictedPath(request.nextUrl.pathname)) {
    try {
      const response = await fetch(new URL("/api/auth/me", request.url), {
        headers: { cookie: request.headers.get("cookie") || "" },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.user?.role === "REGIONAL_STATISTICIAN") {
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
