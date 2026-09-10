import { z } from "zod";
const NetlifyBuildSchema = z
  .object({
    provider: z.literal("netlify"),
    context: z.enum(["production", "deploy-preview", "branch-deploy"]),
    target: z.enum(["production", "staging"]),
    projectRef: z.string().regex(/^[a-z0-9]{20}$/),
    siteId: z.string().uuid(),
    siteName: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict()
  .refine(
    (v) => (v.context === "production") === (v.target === "production"),
    "Build context mismatch",
  );
export const ApplicationBuildSchema = z.union([
  NetlifyBuildSchema,
  z.object({ provider: z.literal("local"), target: z.literal("local") }).strict(),
]);
export type ApplicationBuild = z.infer<typeof ApplicationBuildSchema>;
const RuntimeSchema = z.object({
  deploy: z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/),
    context: z.enum(["production", "deploy-preview", "branch-deploy"]),
    published: z.boolean(),
  }),
  site: z.object({ id: z.string().uuid(), name: z.string() }),
});
export type EnvironmentIssue =
  | "build_unverified"
  | "runtime_unavailable"
  | "runtime_context_mismatch"
  | "runtime_site_mismatch"
  | "preview_published"
  | "domain_target_mismatch"
  | "database_target_mismatch"
  | "public_key_invalid";
export type EnvironmentCheck = { allowed: boolean; issue: EnvironmentIssue | null };
const allow: EnvironmentCheck = { allowed: true, issue: null };
const deny = (issue: EnvironmentIssue): EnvironmentCheck => ({ allowed: false, issue });
export function readApplicationBuild(value: unknown): ApplicationBuild | null {
  try {
    const candidate = typeof value === "string" ? JSON.parse(value) : value;
    const result = ApplicationBuildSchema.safeParse(candidate);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function projectOriginMatches(value: unknown, ref: string): boolean {
  if (typeof value !== "string" || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === `https://${ref}.supabase.co` &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function publicKeyMatches(value: unknown, ref?: string): boolean {
  if (typeof value !== "string" || !value || value.length > 4096 || /\s|\*/.test(value))
    return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true;
  const chunks = value.split(".");
  if (chunks.length !== 3) return false;
  try {
    const decoded: unknown = JSON.parse(atob(chunks[1]!.replaceAll("-", "+").replaceAll("_", "/")));
    const metadata = z.object({ role: z.literal("anon"), ref: z.string() }).safeParse(decoded);
    return metadata.success && (!ref || metadata.data.ref === ref);
  } catch {
    return false;
  }
}
function pageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}
const mainHosts = new Set(["gyms.life", "www.gyms.life"]);
/** Host input may restrict a request; it can never select another data project. */
export function checkBrowserEnvironment(
  build: ApplicationBuild | null,
  href: string,
  configuredDatabase?: string,
): EnvironmentCheck {
  if (!build) return deny("build_unverified");
  const url = pageUrl(href);
  if (!url) return deny("domain_target_mismatch");
  if (build.provider === "local")
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      ["http:", "https:"].includes(url.protocol)
      ? allow
      : deny("build_unverified");
  if (
    configuredDatabase !== undefined &&
    !projectOriginMatches(configuredDatabase, build.projectRef)
  )
    return deny("database_target_mismatch");
  if (url.protocol !== "https:" || url.port) return deny("domain_target_mismatch");
  const primary =
    mainHosts.has(url.hostname) ||
    url.hostname === `${build.siteName}.netlify.app` ||
    url.hostname === `main--${build.siteName}.netlify.app`;
  if (primary) return build.target === "production" ? allow : deny("domain_target_mismatch");
  const suffix = `--${build.siteName}.netlify.app`;
  if (!url.hostname.endsWith(suffix)) return deny("domain_target_mismatch");
  const prefix = url.hostname.slice(0, -suffix.length);
  if (/^[a-f0-9]{24}$/.test(prefix)) return allow;
  if (build.context === "deploy-preview" && /^deploy-preview-[1-9][0-9]*$/.test(prefix))
    return allow;
  if (
    build.context === "branch-deploy" &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(prefix) &&
    prefix !== "main" &&
    !prefix.startsWith("deploy-preview-")
  )
    return allow;
  return deny("domain_target_mismatch");
}
export function checkServerEnvironment(
  build: ApplicationBuild | null,
  href: string,
  context: unknown,
  databaseUrl: string | undefined,
): EnvironmentCheck {
  const publicCheck = checkBrowserEnvironment(build, href, databaseUrl);
  if (!publicCheck.allowed || !build) return publicCheck;
  if (build.provider === "local") {
    if (context !== null && context !== undefined) {
      const dev = z.object({ deploy: z.object({ context: z.literal("dev") }) }).safeParse(context);
      if (!dev.success) return deny("build_unverified");
    }
    return allow;
  }
  const runtime = RuntimeSchema.safeParse(context);
  if (!runtime.success) return deny("runtime_unavailable");
  if (runtime.data.site.id !== build.siteId || runtime.data.site.name !== build.siteName)
    return deny("runtime_site_mismatch");
  if (runtime.data.deploy.context !== build.context) return deny("runtime_context_mismatch");
  if (build.target === "staging" && runtime.data.deploy.published) return deny("preview_published");
  if (!projectOriginMatches(databaseUrl, build.projectRef)) return deny("database_target_mismatch");
  return allow;
}
