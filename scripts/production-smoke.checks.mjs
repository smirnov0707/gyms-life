const pages = ["/", "/auth", "/app", "/twin", "/lab", "/progress", "/history"];

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

const checks = [
  ...pages.map((path) => ({ name: path, path, method: "GET", kind: "page" })),
  {
    // Every page can answer 200 while serving a build from three weeks ago.
    // `cdcfc27` merged the Future Lab visual system into main without the
    // `[release production]` marker, the production build was skipped in
    // silence, and a smoke run that only asked whether pages load would have
    // called that healthy — which it did, for a day.
    name: "deployment-identity",
    path: "/api/public/environment",
    method: "GET",
    kind: "identity",
  },
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
  expectedCommit = null,
} = {}) {
  const origin = new URL(base);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password)
    throw new Error("SMOKE_BASE_URL_INVALID");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    throw new Error("SMOKE_TIMEOUT_INVALID");
  if (expectedCommit !== null && !COMMIT_PATTERN.test(expectedCommit))
    throw new Error("SMOKE_EXPECTED_COMMIT_INVALID");

  const results = [];
  let liveCommit = null;
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
      } else if (check.kind === "identity") {
        const identity = readIdentity(body);
        liveCommit = identity?.sourceCommit ?? null;
        // A build that cannot name itself is not a verified deployment, and a
        // named commit that is not the one released is a deployment that did
        // not happen. Only the second needs an expected value to detect.
        ok =
          response.status === 200 &&
          sameOrigin &&
          identity !== null &&
          identity.status === "compatible" &&
          identity.target === "production" &&
          (expectedCommit === null || identity.sourceCommit === expectedCommit);
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
  return {
    ok: results.every((result) => result.ok),
    executionVerified: false,
    liveCommit,
    commitVerified: expectedCommit !== null && liveCommit === expectedCommit,
    results,
  };
}

/** Reads only the four fields this check uses; the rest of the body is ignored. */
function readIdentity(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.schema !== "gyms-environment.v1") return null;
    if (!COMMIT_PATTERN.test(parsed?.sourceCommit ?? "")) return null;
    return {
      status: parsed.status,
      target: parsed.target,
      sourceCommit: parsed.sourceCommit,
    };
  } catch {
    return null;
  }
}

function failureReason(kind, status, body) {
  if (kind === "identity") {
    const identity = readIdentity(body);
    if (identity === null) return "deployment_identity_unreadable";
    if (identity.status !== "compatible") return "deployment_environment_blocked";
    if (identity.target !== "production") return "deployment_target_mismatch";
    return "deployed_commit_is_not_the_released_commit";
  }
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
