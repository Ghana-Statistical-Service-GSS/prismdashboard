// Request checks of the firm web form's proxy (app/api/firm): which origin
// may write, and which address is the browser's. Plain functions of the
// request headers, so they can be tested without a server.
type HeaderSource = { headers: { get(name: string): string | null }; nextUrl: { protocol: string } };

// The public origin the links point to (the same setting the backend uses
// for them), e.g. https://prism.statsghana.gov.gh.
function publicOrigin() {
  try {
    return new URL(process.env.PPI_FIRM_PUBLIC_URL || "https://prism.statsghana.gov.gh").origin;
  } catch {
    return null;
  }
}

// A write must come from a page of this site (SameSite=Strict already keeps
// the cookie off cross-site requests; this refuses them outright). The
// Origin must be the configured public origin, or this request's own origin
// (scheme and host, as the reverse proxy reports them) - a proxy that
// rewrites Host without X-Forwarded-Host still works through the first.
// Without an Origin header, Sec-Fetch-Site must say same-origin.
export function sameOrigin(request: HeaderSource) {
  const origin = request.headers.get("origin");
  if (origin) {
    let given: URL;
    try {
      given = new URL(origin);
    } catch {
      return false;
    }
    if (given.origin === publicOrigin()) return true;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "")).toLowerCase();
    return !!host && given.host === host && given.protocol === `${proto}:`;
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

// The browser's address: the last X-Forwarded-For hop, the one the reverse
// proxy in front of this app appended (earlier hops are whatever the client
// sent). X-Real-IP only when PRISM_FIRM_TRUST_X_REAL_IP=1 says the reverse
// proxy sets it (and overwrites any sent by the client).
export function clientAddress(request: HeaderSource) {
  if (process.env.PRISM_FIRM_TRUST_X_REAL_IP === "1") {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  const hops = request.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  return hops.length ? hops[hops.length - 1] : null;
}

