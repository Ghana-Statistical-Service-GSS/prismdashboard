import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { ppiDashboardBackendRequest } from "@/lib/backend";

// Pass-through to /api/v1/ppi/dashboard/*. The backend owns every role,
// scope and workflow rule; its JSON (including error.code and field errors)
// is returned unchanged so the review screens can show the real reason, and
// its exports (CSV, and the .xlsx interview data) are returned as downloads,
// byte for byte.
const DOWNLOAD_TYPES = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
// The interview data export reads every submitted interview in scope; it may
// take longer than a screen's request.
const DATA_EXPORT_TIMEOUT_MS = 180_000;
async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { path = [] } = await context.params;
  if (path.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))) {
    return NextResponse.json({ error: { message: "Invalid PPI path" } }, { status: 400 });
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  const query = new URL(request.url).search;
  const body = request.method === "GET" ? undefined : await request.text();
  try {
    const response = await ppiDashboardBackendRequest(`${suffix}${query}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body || undefined,
      timeoutMs: suffix === "/data-export" ? DATA_EXPORT_TIMEOUT_MS : 30_000,
    });
    // Exports pass through as files (binary-safe); everything else is JSON.
    const type = response.headers.get("content-type") || "";
    if (response.ok && DOWNLOAD_TYPES.some((download) => type.startsWith(download))) {
      return new NextResponse(await response.arrayBuffer(), {
        status: response.status,
        headers: {
          "Content-Type": type,
          "Content-Disposition": response.headers.get("content-disposition") || "attachment",
          "Cache-Control": "no-store",
        },
      });
    }
    const data = await response.json().catch(() => null);
    const result = NextResponse.json(data ?? { error: { message: "Unexpected response from the PPI service" } }, { status: response.status });
    // The session is no longer valid (expired, signed out elsewhere): clear
    // it, as /api/auth/me does, so the next page load asks to sign in.
    if (response.status === 401) result.cookies.delete(SESSION_COOKIE);
    return result;
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "PPI service unavailable" } }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
