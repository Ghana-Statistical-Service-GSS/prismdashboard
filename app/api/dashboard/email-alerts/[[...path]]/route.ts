import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { path = [] } = await context.params;
  if (path.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))) {
    return NextResponse.json({ error: { message: "Invalid email alert path" } }, { status: 400 });
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  const body = request.method === "GET" ? undefined : await request.text();
  try {
    const response = await dashboardBackendRequest(`/email-alerts${suffix}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body || undefined,
      timeoutMs: request.method === "POST" ? 30_000 : 10_000,
    });
    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Email alert service unavailable" } }, { status });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
