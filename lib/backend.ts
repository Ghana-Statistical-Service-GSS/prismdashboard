import http from "node:http";
import https from "node:https";

const BACKEND_URL = (process.env.PRISM_BACKEND_URL || "http://localhost:6000").replace(/\/$/, "");

export function dashboardBackendUrl(path: string) {
  return `${BACKEND_URL}/api/v1/dashboard${path}`;
}

type BackendRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

// Node's native fetch follows the browser unsafe-port list and blocks port 6000.
// The PRISM backend currently uses that port, so server-to-server calls use the
// lower-level Node HTTP client instead.
export function dashboardBackendRequest(path: string, init: BackendRequestInit = {}) {
  const url = new URL(dashboardBackendUrl(path));
  const client = url.protocol === "https:" ? https : http;

  return new Promise<Response>((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: init.method || "GET",
        headers: init.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
            else if (value !== undefined) headers.set(name, value);
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode || 500,
              statusText: response.statusMessage,
              headers,
            })
          );
        });
      }
    );
    request.on("error", reject);
    request.setTimeout(10_000, () => request.destroy(new Error("Backend request timed out")));
    if (init.body) request.write(init.body);
    request.end();
  });
}

export async function readBackendResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "The authentication service could not complete the request.";
    throw new BackendError(message, response.status, data?.error?.code);
  }
  return data;
}

export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}
