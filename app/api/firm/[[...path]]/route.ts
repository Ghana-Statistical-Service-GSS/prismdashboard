import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ppiFirmBackendRequest } from "@/lib/backend";
import { clientAddress, sameOrigin } from "@/lib/firm-proxy";

// Pass-through to /api/v1/ppi/firm/* for the firm's public web form. The
// backend owns every rule (code check, limits, session scope, editing); this
// route only keeps the session token in an httpOnly cookie the page's
// scripts never see, checks that writes come from this site, and marks
// every answer as not cacheable and not indexable. It never forwards the
// dashboard's session cookie or an Authorization header.
const COOKIE = "prism_firm";
const COOKIE_PATH = "/api/firm";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function json(body: unknown, status: number) {
  return noStore(NextResponse.json(body, { status }));
}

const secure = (request: NextRequest) =>
  process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

async function forward(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  if (!path.length || path.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))) {
    return json({ error: { code: "INVALID_PATH", message: "Invalid address." } }, 400);
  }
  const method = request.method;
  if (method !== "GET" && !sameOrigin(request)) {
    return json({ error: { code: "CSRF_FAILED", message: "The form could not be verified. Reload the page and try again." } }, 403);
  }
  const token = (await cookies()).get(COOKIE)?.value;
  const csrf = request.headers.get("x-firm-csrf");
  const ip = clientAddress(request);
  const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["X-Firm-Session"] = token;
  if (csrf) headers["X-Firm-CSRF"] = csrf;
  // The address for the backend's per-address limits, believed there only
  // with the shared key (PPI_FIRM_PROXY_SECRET on both); X-Forwarded-For
  // too, for a backend that relies on TRUST_PROXY instead.
  if (ip) {
    headers["X-Forwarded-For"] = ip;
    const key = process.env.PPI_FIRM_PROXY_SECRET;
    if (key && key.length >= 16) {
      headers["X-Firm-Client-IP"] = ip;
      headers["X-Firm-Proxy-Key"] = key;
    }
  }

  let response: Response;
  try {
    response = await ppiFirmBackendRequest(`/${path.join("/")}`, { method, headers, body: body || undefined, timeoutMs: 30_000 });
  } catch {
    return json({ error: { code: "SERVICE_UNAVAILABLE", message: "The form could not reach the server. Check your connection; we will try again." } }, 503);
  }
  const data = await response.json().catch(() => null);
  const isSessionStart = method === "POST" && path.length === 3 && path[0] === "links" && path[2] === "session";

  if (isSessionStart && response.status === 201 && data?.sessionToken) {
    const { sessionToken, ...rest } = data;
    const result = json(rest, 201);
    result.cookies.set(COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: secure(request),
      path: COOKIE_PATH,
      // As long as a session can live (12 h); the server ends an idle one
      // sooner, and the proxy then clears the cookie.
      maxAge: Number(data.maxAgeSeconds) || 12 * 3600,
    });
    return result;
  }

  const result = json(data ?? { error: { code: "UNEXPECTED", message: "Unexpected answer from the server." } }, response.status);
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) result.headers.set("Retry-After", retryAfter);
  const code = data?.error?.code;
  const ended = method === "DELETE" && path[2] === "session" && response.ok;
  if (ended || code === "FIRM_SESSION_REQUIRED" || code === "FIRM_SESSION_EXPIRED") {
    result.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", secure: secure(request), path: COOKIE_PATH, maxAge: 0 });
  }
  return result;
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
