import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

const allowed = ["itemId", "uomType", "uom", "search", "regionId", "districtId", "marketId", "userId"];

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const incoming = new URL(request.url).searchParams;
  const outgoing = new URLSearchParams();
  for (const key of allowed) {
    const value = incoming.get(key);
    if (value) outgoing.set(key, value);
  }
  try {
    const response = await dashboardBackendRequest(`/validations/initiation/comparisons/export?${outgoing}`, { headers: { Authorization: `Bearer ${token}` } });
    return NextResponse.json(await readBackendResponse(response));
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Export unavailable" } }, { status });
  }
}
