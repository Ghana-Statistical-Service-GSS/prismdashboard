// The firm form's calls, through this site's /api/firm proxy (which keeps
// the session in an httpOnly cookie). A failed connection throws
// NetworkError; every answer from the server is returned with its status.
import type { ApiError, FirmFormResponse, Operation, OperationResult } from "./types";

export class NetworkError extends Error {}

export type Answer<T> = { status: number; data: T | null; error: ApiError | null };

async function call<T>(path: string, init: { method?: string; csrf?: string | null; body?: unknown } = {}): Promise<Answer<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/firm/${path}`, {
      method: init.method || "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.csrf ? { "X-Firm-CSRF": init.csrf } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new NetworkError("No connection");
  }
  const json = await response.json().catch(() => null);
  if (response.ok) return { status: response.status, data: json as T, error: null };
  return { status: response.status, data: null, error: (json?.error as ApiError) || { message: "Unexpected answer from the server." } };
}

const link = (slug: string) => `links/${encodeURIComponent(slug)}`;

// Without this link's session the server says only ENTER_CODE (the same for
// every link, real or not); OPEN/CLOSED come only with the session.
export type LinkStatus = {
  state: "ENTER_CODE" | "OPEN" | "CLOSED";
  session: { csrfToken: string; expiresAt: string } | null;
  closedReason: string | null;
  status: string | null;
};

export const firmApi = {
  link: (slug: string) => call<LinkStatus>(link(slug)),
  start: (slug: string, code: string) => call<{ csrfToken: string; expiresAt: string }>(`${link(slug)}/session`, { method: "POST", body: { code } }),
  end: (slug: string, csrf: string) => call<{ ended: boolean }>(`${link(slug)}/session`, { method: "DELETE", csrf }),
  form: (slug: string) => call<FirmFormResponse>(`${link(slug)}/form`),
  save: (slug: string, csrf: string, operations: Operation[]) =>
    call<{ results: OperationResult[]; invite: { status: string; closedReason: string | null } }>(`${link(slug)}/operations`, { method: "POST", csrf, body: { operations } }),
  handOver: (slug: string, csrf: string) => call<{ status: string; unchanged: boolean }>(`${link(slug)}/handover`, { method: "POST", csrf }),
};
