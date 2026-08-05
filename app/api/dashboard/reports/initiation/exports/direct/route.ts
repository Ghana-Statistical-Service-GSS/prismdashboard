import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { dashboardBackendUrl } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });

  try {
    const incoming = new URL(request.url);
    const backendUrl = new URL(dashboardBackendUrl("/reports/initiation/exports/direct"));
    backendUrl.search = incoming.search;
    const response = await fetch(backendUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: request.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return NextResponse.json(
        { error: { message: body?.error?.message || "Unable to prepare direct download" } },
        { status: response.status },
      );
    }

    const headers = new Headers();
    for (const name of ["content-type", "content-disposition", "cache-control", "x-accel-buffering"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Direct download unavailable" } },
      { status: 503 },
    );
  }
}
