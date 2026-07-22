import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

export async function GET(request: Request, context: { params: Promise<{ entity: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { entity } = await context.params;
  if (!/^(regions|districts|markets|outlets|items)$/.test(entity)) return NextResponse.json({ error: { message: "Invalid configuration catalogue" } }, { status: 400 });
  const query = new URL(request.url).search;
  try {
    const response = await dashboardBackendRequest(`/configuration/${entity}${query}`, { headers: { Authorization: `Bearer ${token}` } });
    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Configuration service unavailable" } }, { status });
  }
}
