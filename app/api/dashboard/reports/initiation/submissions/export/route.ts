import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { BackendError, dashboardBackendRequest, readBackendResponse } from "@/lib/backend";

const allowed = ["regionId", "districtId", "marketId", "userId", "uom", "uomType", "search", "supervisorApproval", "rsApproval", "hqApproval", "approvalGroup"];

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
    const response = await dashboardBackendRequest(`/reports/initiation/submissions/export?${outgoing}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status !== 404) return NextResponse.json(await readBackendResponse(response));

    // Some deployed backend versions predate the dedicated export route. The
    // paginated submissions route contains the same rows, so assemble the full
    // export from it instead of exposing a production-only 404 to the user.
    const rows = await loadPaginatedExport(token, outgoing);
    return NextResponse.json({ rows });
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Export unavailable" } },
      { status }
    );
  }
}

async function loadPaginatedExport(token: string, filters: URLSearchParams) {
  const pageSize = 100;
  const loadPage = async (page: number) => {
    const query = new URLSearchParams(filters);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
    const response = await dashboardBackendRequest(`/reports/initiation/submissions?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return readBackendResponse(response);
  };

  const first = await loadPage(1);
  const rows = [...(first?.rows || [])];
  const totalPages = Math.max(1, Number(first?.pagination?.total_pages) || 1);

  // Keep concurrency bounded so a large export does not overwhelm PostgreSQL.
  for (let start = 2; start <= totalPages; start += 6) {
    const pages = Array.from({ length: Math.min(6, totalPages - start + 1) }, (_, index) => start + index);
    const results = await Promise.all(pages.map(loadPage));
    for (const result of results) rows.push(...(result?.rows || []));
  }
  return rows.map((row: Record<string, unknown>) => ({
    ...row,
    unique_id: row.unique_id ?? row.id,
    brand: row.brand ?? row.product_name,
    uom: row.uom ?? row.uom_standard ?? row.uom_local,
  }));
}
