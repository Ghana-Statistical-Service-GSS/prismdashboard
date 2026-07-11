import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });

  try {
    const response = await dashboardBackendRequest("/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Dashboard data unavailable" } },
      { status }
    );
  }
}
