import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  try {
    const response = await dashboardBackendRequest("/reports/initiation/submissions/approve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Approval failed" } }, { status });
  }
}
