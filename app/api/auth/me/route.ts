import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  }

  try {
    const response = await dashboardBackendRequest("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    const result = NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Session check failed" } },
      { status }
    );
    if (status === 401 || status === 403) result.cookies.delete(SESSION_COOKIE);
    return result;
  }
}
