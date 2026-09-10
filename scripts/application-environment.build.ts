import {
  ApplicationBuildSchema,
  projectOriginMatches,
  publicKeyMatches,
  type ApplicationBuild,
} from "../src/lib/application-environment";
const PROJECTS = { production: "tqwqbjkjqzusohxdzupr", staging: "yywnpovsqifwujuxdxog" } as const;
const SITE_ID = "0d17652b-c26c-4ada-9792-d332c7572536",
  SITE_NAME = "singular-vacherin-57448d";
/** Validated non-secret metadata baked into the bundle, not inherited browser storage. */
export function createApplicationBuild(env: Record<string, string | undefined>): ApplicationBuild {
  const context = env["CONTEXT"],
    managed = env["NETLIFY"] === "true" || Boolean(context);
  if (!managed || context === "dev") {
    if (
      env["VITE_SUPABASE_PUBLISHABLE_KEY"] &&
      !publicKeyMatches(env["VITE_SUPABASE_PUBLISHABLE_KEY"])
    )
      throw new Error("APP_BUILD_PUBLIC_KEY_INVALID");
    return { provider: "local", target: "local" };
  }
  if (!["production", "deploy-preview", "branch-deploy"].includes(context ?? ""))
    throw new Error("APP_BUILD_CONTEXT_UNVERIFIED");
  const target = context === "production" ? "production" : "staging",
    ref = PROJECTS[target];
  if (env["SITE_ID"] !== SITE_ID || env["SITE_NAME"] !== SITE_NAME)
    throw new Error("APP_BUILD_SITE_UNVERIFIED");
  if (
    !projectOriginMatches(env["VITE_SUPABASE_URL"], ref) ||
    env["VITE_SUPABASE_PROJECT_ID"] !== ref
  )
    throw new Error("APP_BUILD_CLIENT_TARGET_MISMATCH");
  if (!projectOriginMatches(env["SUPABASE_URL"], ref) || env["SUPABASE_PROJECT_ID"] !== ref)
    throw new Error("APP_BUILD_SERVER_TARGET_MISMATCH");
  if (
    !publicKeyMatches(env["VITE_SUPABASE_PUBLISHABLE_KEY"], ref) ||
    !publicKeyMatches(env["SUPABASE_PUBLISHABLE_KEY"], ref)
  )
    throw new Error("APP_BUILD_PUBLIC_KEY_INVALID");
  const report = ApplicationBuildSchema.safeParse({
    provider: "netlify",
    context,
    target,
    projectRef: ref,
    siteId: SITE_ID,
    siteName: SITE_NAME,
    sourceCommit: env["COMMIT_REF"],
  });
  if (!report.success) throw new Error("APP_BUILD_REVISION_UNVERIFIED");
  return report.data;
}
