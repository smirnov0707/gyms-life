import { z } from "zod";

const RuntimeDeploymentSchema = z.object({
  deploy: z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/),
    context: z.enum(["production", "deploy-preview", "branch-deploy"]),
    published: z.boolean(),
  }),
  site: z.object({ name: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/) }),
});
const PROJECTS = { production: "tqwqbjkjqzusohxdzupr", staging: "yywnpovsqifwujuxdxog" } as const;

/** Only provider-owned runtime metadata may identify a deployed worker. */
export function nightLabRuntimeTarget(
  context: unknown,
): { origin: string; databaseOrigin: string } | null {
  const parsed = RuntimeDeploymentSchema.safeParse(context);
  if (!parsed.success) return null;
  const { deploy, site } = parsed.data;
  const production = deploy.context === "production";
  // A retired production bundle must not schedule today's job on old code.
  if (production !== deploy.published) return null;
  const host = `${deploy.id}--${site.name}.netlify.app`;
  return {
    origin: `https://${host}`,
    databaseOrigin: `https://${PROJECTS[production ? "production" : "staging"]}.supabase.co`,
  };
}

export function matchesNightLabDatabase(
  value: string | undefined,
  expectedOrigin: string,
): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      value.trim() === value &&
      url.origin === expectedOrigin &&
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
