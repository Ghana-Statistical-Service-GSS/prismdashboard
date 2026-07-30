import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

async function token() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function GET(request: Request) {
  const session = await token();
  if (!session) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const limit = new URL(request.url).searchParams.get("limit") || "10";
  try {
    const response = await dashboardBackendRequest(`/reports/initiation/exports?limit=${encodeURIComponent(limit)}`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Exports unavailable" } }, { status });
  }
}

export async function POST(request: Request) {
  const session = await token();
  if (!session) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: { message: "Invalid export selection" } }, { status: 400 });
  try {
    const response = await dashboardBackendRequest("/reports/initiation/exports", {
      method: "POST",
      headers: { Authorization: `Bearer ${session}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Unable to start export" } }, { status });
  }
}
