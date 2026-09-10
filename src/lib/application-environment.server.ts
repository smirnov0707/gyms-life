import { getContext } from "@netlify/functions";
import { currentApplicationBuild } from "./application-build";
import {
  checkServerEnvironment,
  type ApplicationBuild,
  type EnvironmentCheck,
} from "./application-environment";
type ContextSource = {
  build: ApplicationBuild | null;
  context: unknown;
  databaseUrl: string | undefined;
};
export function currentApplicationEnvironment(): ContextSource {
  const build = currentApplicationBuild();
  try {
    const context = getContext();
    return {
      build,
      context,
      databaseUrl: build?.provider === "local" ? undefined : Netlify.env.get("SUPABASE_URL"),
    };
  } catch {
    return { build, context: null, databaseUrl: undefined };
  }
}
const noStore = {
  "cache-control": "no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};
function environmentBlocked(request: Request, check: EnvironmentCheck): Response {
  if (
    new URL(request.url).pathname.startsWith("/api/") ||
    request.headers.get("accept")?.includes("application/json")
  )
    return Response.json(
      { error: "APPLICATION_ENVIRONMENT_UNSAFE", code: check.issue },
      { status: 503, headers: noStore },
    );
  const lt = request.headers.get("accept-language")?.toLowerCase().startsWith("lt") ?? false;
  const title = lt ? "Aplinkos saugos patikra" : "Environment safety check";
  const detail = lt
    ? "Šios versijos adresas arba duomenų aplinka nesutampa. Prisijungimas ir duomenų veiksmai sustabdyti. Įrenginyje saugomi treniruočių įrašai nepakeisti."
    : "This version's address or data environment does not match. Sign-in and data actions are blocked. Workout records stored on this device are unchanged.";
  return new Response(
    `<!doctype html><html lang="${lt ? "lt" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} — GYMS.LIFE</title><style>html{font-family:system-ui,sans-serif;color-scheme:light dark}body{margin:0;padding:32px 20px}main{max-width:620px;margin:12vh auto}h1{font-size:clamp(24px,5vw,36px);line-height:1.2}p{line-height:1.65}small{opacity:.7}</style></head><body><main><small>GYMS.LIFE</small><h1>${title}</h1><p>${detail}</p><p>${lt ? "Bandomajai versijai naudok jos atskirą peržiūros nuorodą. Pagrindinės svetainės diegimą turi patikrinti administratorius." : "Use the separate preview link for a test version. An administrator must verify the main site's deployment."}</p></main></body></html>`,
    {
      status: 503,
      headers: {
        ...noStore,
        "content-type": "text/html; charset=utf-8",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      },
    },
  );
}
/** Must wrap the lazy framework import, not only an individual action. */
export async function withApplicationEnvironment(
  request: Request,
  perform: () => Promise<Response>,
  source: () => ContextSource = currentApplicationEnvironment,
): Promise<Response> {
  let snapshot: ContextSource;
  try {
    snapshot = source();
  } catch {
    snapshot = { build: null, context: null, databaseUrl: undefined };
  }
  const check = checkServerEnvironment(
    snapshot.build,
    request.url,
    snapshot.context,
    snapshot.databaseUrl,
  );
  if (new URL(request.url).pathname === "/api/public/environment") {
    const build = snapshot.build;
    return Response.json(
      {
        schema: "gyms-environment.v1",
        status: check.allowed ? "compatible" : "blocked",
        target: build?.target ?? "unknown",
        buildContext:
          build?.provider === "netlify" ? build.context : (build?.provider ?? "unknown"),
        sourceCommit: build?.provider === "netlify" ? build.sourceCommit : null,
        issue: check.issue,
        scope: "deployment_identity_only_not_authentication_or_database_acceptance",
      },
      { status: check.allowed ? 200 : 503, headers: noStore },
    );
  }
  return check.allowed ? perform() : environmentBlocked(request, check);
}
