import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { rebasingDashboardBackendRequest } from "@/lib/backend";

// Pass-through to /api/v1/rebasing/dashboard/*. The backend owns every role,
// scope and state-transition rule; its JSON (including error.code and
// error.blockers) is returned unchanged so the UI can show the real reason.
async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { path = [] } = await context.params;
  if (path.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))) {
    return NextResponse.json({ error: { message: "Invalid Market Reading path" } }, { status: 400 });
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  const query = new URL(request.url).search;
  const body = request.method === "GET" ? undefined : await request.text();
  try {
    const response = await rebasingDashboardBackendRequest(`${suffix}${query}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body || undefined,
      // Opening a period freezes the whole frame (~150k rows) in one transaction.
      timeoutMs: path.at(-1) === "open" ? 180_000 : 30_000,
    });
    const data = await response.json().catch(() => null);
    return NextResponse.json(data ?? { error: { message: "Unexpected response from the Market Reading service" } }, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Market Reading service unavailable" } }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
