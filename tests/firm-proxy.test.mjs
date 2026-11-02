// The firm web form proxy's request checks (lib/firm-proxy.ts).
// Run: node --experimental-strip-types --test tests/firm-proxy.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { clientAddress, sameOrigin } from "../lib/firm-proxy.ts";

const req = (headers, protocol = "https:") => ({
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  nextUrl: { protocol },
});

test("writes: the public origin, or this request's own scheme and host; never a foreign origin", () => {
  process.env.PPI_FIRM_PUBLIC_URL = "https://prism.statsghana.gov.gh";
  // Behind a proxy that rewrites Host and sets no X-Forwarded-Host.
  assert.equal(sameOrigin(req({ origin: "https://prism.statsghana.gov.gh", host: "127.0.0.1:3000" }, "http:")), true);
  assert.equal(sameOrigin(req({ origin: "https://app.example", host: "app.example" })), true);
  assert.equal(sameOrigin(req({ origin: "https://app.example", "x-forwarded-host": "app.example", host: "internal:3000", "x-forwarded-proto": "https" }, "http:")), true);
  assert.equal(sameOrigin(req({ origin: "http://app.example", host: "app.example" })), false, "scheme must match");
  assert.equal(sameOrigin(req({ origin: "https://evil.example", host: "app.example" })), false);
  assert.equal(sameOrigin(req({ origin: "https://prism.statsghana.gov.gh.evil.example", host: "app.example" })), false);
  assert.equal(sameOrigin(req({ origin: "null", host: "app.example" })), false);
  assert.equal(sameOrigin(req({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(sameOrigin(req({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(sameOrigin(req({})), false);
});

test("client address: the proxy-appended last X-Forwarded-For hop; X-Real-IP only when the deployment says so", () => {
  delete process.env.PRISM_FIRM_TRUST_X_REAL_IP;
  assert.equal(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9");
  assert.equal(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "1.2.3.4" })), "203.0.113.9");
  assert.equal(clientAddress(req({ "x-real-ip": "1.2.3.4" })), null);
  process.env.PRISM_FIRM_TRUST_X_REAL_IP = "1";
  assert.equal(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "1.2.3.4" })), "1.2.3.4");
  delete process.env.PRISM_FIRM_TRUST_X_REAL_IP;
  assert.equal(clientAddress(req({})), null);
});

test("client address on Netlify: x-nf-client-connection-ip only when PRISM_FIRM_TRUST_NF_IP=1", () => {
  delete process.env.PRISM_FIRM_TRUST_NF_IP;
  assert.equal(clientAddress(req({ "x-nf-client-connection-ip": "198.51.100.4" })), null, "not believed unless the deployment says so");
  assert.equal(clientAddress(req({ "x-nf-client-connection-ip": "198.51.100.4", "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  process.env.PRISM_FIRM_TRUST_NF_IP = "1";
  assert.equal(clientAddress(req({ "x-nf-client-connection-ip": "198.51.100.4", "x-forwarded-for": "6.6.6.6" })), "198.51.100.4");
  assert.equal(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9", "falls back when the header is absent");
  delete process.env.PRISM_FIRM_TRUST_NF_IP;
});
