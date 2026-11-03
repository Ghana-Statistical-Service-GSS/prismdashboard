import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { rebasingDashboardBackendRequest, rebasingDashboardBackendUrl } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A path segment is a plain name; a CSV download's last segment ends in ".csv".
const SEGMENT = /^[a-zA-Z0-9-]+$/;
const CSV_SEGMENT = /^[a-zA-Z0-9-]+\.csv$/;
// How long the backend may take to start a download (it validates the request
// and sends its headers first); the file itself streams for as long as it takes.
const DOWNLOAD_START_MS = 30_000;

// Pass-through to /api/v1/rebasing/dashboard/*. The backend owns every role,
// scope and state-transition rule; its JSON (including error.code and
// error.blockers) is returned unchanged so the UI can show the real reason.
async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Not signed in" } }, { status: 401 });
  const { path = [] } = await context.params;
  const csv = request.method === "GET" && path.length > 0 && CSV_SEGMENT.test(path[path.length - 1]);
  if (path.some((segment, index) => !SEGMENT.test(segment) && !(csv && index === path.length - 1))) {
    return NextResponse.json({ error: { message: "Invalid Market Reading path" } }, { status: 400 });
  }
  const suffix = path.length ? `/${path.join("/")}` : "";
  const query = new URL(request.url).search;
  if (csv) return download(`${suffix}${query}`, token, request);
  const body = request.method === "GET" ? undefined : await request.text();
  try {
    const response = await rebasingDashboardBackendRequest(`${suffix}${query}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body || undefined,
      // Opening a period freezes the whole frame (~150k rows) in one transaction;
      // recording a whole scope as not collected can mark as many.
      timeoutMs: path.at(-1) === "open" || path.at(-1) === "not-collected" ? 180_000 : 30_000,
    });
    const data = await response.json().catch(() => null);
    return NextResponse.json(data ?? { error: { message: "Unexpected response from the Market Reading service" } }, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "Market Reading service unavailable" } }, { status: 503 });
  }
}

// CSV downloads are streamed, not buffered: a national month is ~100 MB. The
// browser closing the download aborts the backend request, which then stops
// reading the database. Errors before the file starts are JSON, as for any route.
async function download(path: string, token: string, request: Request) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, DOWNLOAD_START_MS);
  try {
    const response = await fetch(rebasingDashboardBackendUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return NextResponse.json(data ?? { error: { message: "The download could not be prepared" } }, { status: response.status });
    }
    const headers = new Headers();
    for (const name of ["content-type", "content-disposition", "cache-control", "x-accel-buffering"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted && !request.signal.aborted;
    const message = timedOut ? "The Market Reading service did not start the download in time" : error instanceof Error ? error.message : "Market Reading service unavailable";
    return NextResponse.json({ error: { message } }, { status: timedOut ? 504 : 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
