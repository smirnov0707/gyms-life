const pages = ["/", "/auth", "/app", "/twin", "/lab", "/progress", "/history"];

const checks = [
  ...pages.map((path) => ({ name: path, path, method: "GET", kind: "page" })),
  {
    name: "night-lab-public-guard",
    path: "/.netlify/functions/night-lab",
    method: "GET",
    kind: "schedule",
  },
  {
    name: "night-lab-dispatch-auth-guard",
    path: "/api/internal/night-lab",
    method: "POST",
    kind: "dispatch",
  },
];

/** Public HTTP checks only: never send credentials or invoke the background worker. */
export async function runProductionSmoke({
  base = "https://gyms.life",
  timeoutMs = 15000,
  transport = fetch,
} = {}) {
  const origin = new URL(base);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password)
    throw new Error("SMOKE_BASE_URL_INVALID");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    throw new Error("SMOKE_TIMEOUT_INVALID");

  const results = [];
  for (const check of checks) {
    try {
      const response = await transport(new URL(check.path, origin), {
        method: check.method,
        // A redirect must not turn an API failure into a healthy login page.
        redirect: check.kind === "page" ? "follow" : "manual",
        credentials: "omit",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent": "GYMS.LIFE-production-smoke/2.0",
          ...(check.kind === "dispatch" ? { "content-type": "application/json" } : {}),
        },
        ...(check.kind === "dispatch" ? { body: "{}" } : {}),
      });
      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const sameOrigin = !response.url || new URL(response.url).origin === origin.origin;
      let ok;
      if (check.kind === "page") {
        ok =
          response.status === 200 &&
          sameOrigin &&
          /text\/html/i.test(contentType) &&
          /<!doctype html>/i.test(body) &&
          /GYMS\.LIFE/i.test(body) &&
          !/Environment safety check/i.test(body);
      } else if (check.kind === "schedule") {
        ok = response.status === 401 || response.status === 403;
      } else {
        // Only the application's configured auth guard is success here.
        // 202 means accidental dispatch, 500 means configuration is missing.
        ok =
          response.status === 401 &&
          /text\/plain/i.test(contentType) &&
          body.trim() === "Unauthorized";
      }
      results.push({
        name: check.name,
        ok,
        status: response.status,
        reason: ok ? "expected_response" : failureReason(check.kind, response.status, body),
      });
    } catch {
      // Never log arbitrary remote response bodies or transport error payloads.
      results.push({
        name: check.name,
        ok: false,
        status: null,
        reason: "request_failed_or_timed_out",
      });
    }
  }
  return { ok: results.every((result) => result.ok), executionVerified: false, results };
}

function failureReason(kind, status, body) {
  if (kind === "dispatch" && status >= 500) return "night_lab_configuration_or_runtime_unavailable";
  if (kind === "dispatch" && status === 202) return "unauthenticated_dispatch_accepted";
  if (/Environment safety check/i.test(body)) return "environment_safety_block";
  try {
    if (JSON.parse(body)?.error === "usage_exceeded") return "hosting_usage_exceeded";
  } catch {
    /* Non-JSON bodies are deliberately not logged. */
  }
  return "unexpected_http_response";
}
