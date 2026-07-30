import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { jobId } = await context.params;
  try {
    const response = await dashboardBackendRequest(`/reports/initiation/exports/${encodeURIComponent(jobId)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Download unavailable" } }, { status });
  }
}
