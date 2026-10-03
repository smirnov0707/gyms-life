import { readFileSync } from "node:fs";
import path from "node:path";
/**
 * Each page is checked against the title it serves, not against "some page".
 *
 * These five render their own `head()` before authentication, so an
 * unauthenticated GET names the route that matched even though the body is a
 * spinner. Without the title, all five passed on any same-origin HTML document
 * containing the string GYMS.LIFE — which is every page on the site, including
 * the one you get when the router falls over.
 */
/**
 * The landing title is read out of the route, not retyped here.
 *
 * It was the literal "GYMS.LIFE — Your personal Future Lab". When `index.tsx`
 * started building its head from the landing hero's own words, production
 * served "Train on the record. Not on a guess. — GYMS.LIFE" and this check
 * reported the correct page as the wrong one — one more copy of a claim that
 * nothing kept in step with its source.
 *
 * Deriving it keeps what the check is for and sharpens it: the live title is
 * now compared against the title this working tree builds, so a deploy serving
 * a stale bundle still fails, and an intentional rewrite no longer does.
 */
export function landingTitle() {
  const route = readFileSync(path.join(process.cwd(), "src/routes/index.tsx"), "utf8");
  const template = /const SHARE_TITLE = `\$\{hero\.title\} \$\{hero\.accent\} — ([^`]+)`/.exec(
    route,
  );
  const landing = readFileSync(
    path.join(process.cwd(), "src/components/FutureLabLanding.tsx"),
    "utf8",
  );
  const english = landing.slice(landing.indexOf("  en: {"), landing.indexOf("  lt: {"));
  const read = (key) => new RegExp(`${key}:\\s*\n?\\s*"([^"]+)"`).exec(english)?.[1];
  const [title, accent, suffix] = [read("title"), read("accent"), template?.[1]];
  if (!title || !accent || !suffix)
    throw new Error("production smoke: cannot read the landing title from source");
  return `${title} ${accent} — ${suffix}`;
}

const pages = [
  { path: "/", title: landingTitle() },
  { path: "/auth", title: "Prisijungimas — GYMS.LIFE treniruočių programėlė" },
  { path: "/app", title: "Today — GYMS.LIFE" },
  { path: "/twin", title: "My Twin — GYMS.LIFE" },
  { path: "/lab", title: "Lab — GYMS.LIFE FUTURE LAB" },
];

/**
 * These two are redirects, and were checked as pages with `redirect: "follow"`.
 * Both land on /twin, so two of the seven page results were a third and fourth
 * reading of the Twin page reported under another name. Checked here as what
 * they are: the destination is the thing that can break.
 */
const redirects = [
  { path: "/progress", to: "/twin?view=future" },
  { path: "/history", to: "/twin?view=journal" },
];

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

const checks = [
  ...pages.map(({ path, title }) => ({ name: path, path, method: "GET", kind: "page", title })),
  ...redirects.map(({ path, to }) => ({ name: path, path, method: "GET", kind: "redirect", to })),
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
          documentTitle(body) === check.title &&
          !/Environment safety check/i.test(body);
      } else if (check.kind === "redirect") {
        ok =
          [301, 302, 307, 308].includes(response.status) &&
          redirectTarget(response, origin) === check.to;
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

/** The document's own title, or null when it has none. */
function documentTitle(body) {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim() ?? null;
}

/** Where a redirect points, as a same-origin path and query. */
function redirectTarget(response, origin) {
  const location = response.headers.get("location");
  if (!location) return null;
  try {
    const target = new URL(location, origin);
    return target.origin === origin.origin ? `${target.pathname}${target.search}` : null;
  } catch {
    return null;
  }
}

function failureReason(kind, status, body) {
  if (kind === "redirect") return "redirect_missing_or_retargeted";
  // A page carrying the environment safety error is diagnosed below, before
  // the title is blamed: the block is the reason the wrong page was served.
  if (
    kind === "page" &&
    status === 200 &&
    documentTitle(body) !== null &&
    !/Environment safety check/i.test(body)
  )
    return "page_served_is_not_the_page_requested";
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
