import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });

  try {
    const query = request.nextUrl.searchParams.toString();
    const response = await dashboardBackendRequest(`/overview/breakdown${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Dashboard breakdown unavailable" } },
      { status }
    );
  }
}
