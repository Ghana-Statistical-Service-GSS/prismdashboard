import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });

  try {
    const response = await dashboardBackendRequest("/auth/password", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(await request.json()),
    });
    const data = await readBackendResponse(response);
    const result = NextResponse.json(data);
    result.cookies.delete(SESSION_COOKIE);
    return result;
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Password change failed" } },
      { status }
    );
  }
}
