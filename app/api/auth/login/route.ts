import { NextResponse } from "next/server";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await dashboardBackendRequest("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readBackendResponse(response);
    const result = NextResponse.json({ user: data.user });
    result.cookies.set(SESSION_COOKIE, data.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return result;
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { message: "Authentication service is unavailable." } },
      { status: 503 }
    );
  }
}
