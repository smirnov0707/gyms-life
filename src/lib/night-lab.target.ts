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

export interface NightLabTarget {
  origin: string;
  databaseOrigin: string;
}

/**
 * Why the runtime would not identify a deployed worker.
 *
 * The first firing of the schedule, on 2026-10-03 03:10 UTC after three weeks
 * of nothing, recorded `TARGET_DEPLOYMENT_UNIDENTIFIED` — which is six
 * different problems wearing one name. Knowing that the context did not satisfy
 * the schema says nothing about which field, and the field is the whole
 * question: a missing `deploy` means the scheduled runtime hands over less than
 * a request does, an unrecognised `deploy.id` means the shape changed, and
 * the `TARGET_DEPLOYMENT_*` pair is not a shape problem at all.
 *
 * One code per cause, in the ledger's `error_code` format
 * (`^[A-Z][A-Z0-9_]{2,63}$`), so the next firing names what to fix.
 */
export const TARGET_CONTEXT_REFUSALS = [
  "TARGET_CONTEXT_NOT_AN_OBJECT",
  "TARGET_CONTEXT_DEPLOY_MISSING",
  "TARGET_CONTEXT_DEPLOY_ID_UNRECOGNISED",
  "TARGET_CONTEXT_NOT_A_KNOWN_CONTEXT",
  "TARGET_CONTEXT_PUBLISHED_MISSING",
  "TARGET_CONTEXT_SITE_MISSING",
  "TARGET_CONTEXT_SITE_NAME_UNRECOGNISED",
  "TARGET_DEPLOYMENT_PRODUCTION_UNPUBLISHED",
  "TARGET_DEPLOYMENT_PUBLISHED_OFF_PRODUCTION",
] as const;
export type TargetContextRefusal = (typeof TARGET_CONTEXT_REFUSALS)[number];

/** Which field a parse issue is about, by the path Zod reports for it. */
const REFUSAL_BY_PATH: Record<string, TargetContextRefusal> = {
  "": "TARGET_CONTEXT_NOT_AN_OBJECT",
  deploy: "TARGET_CONTEXT_DEPLOY_MISSING",
  "deploy.id": "TARGET_CONTEXT_DEPLOY_ID_UNRECOGNISED",
  "deploy.context": "TARGET_CONTEXT_NOT_A_KNOWN_CONTEXT",
  "deploy.published": "TARGET_CONTEXT_PUBLISHED_MISSING",
  site: "TARGET_CONTEXT_SITE_MISSING",
  "site.name": "TARGET_CONTEXT_SITE_NAME_UNRECOGNISED",
};

/**
 * The same decision as `nightLabRuntimeTarget`, with the reason kept.
 *
 * Only field paths are reported, never values: a path names what is wrong and
 * carries nothing from the runtime into the ledger.
 */
export function explainNightLabTarget(
  context: unknown,
): { ok: true; target: NightLabTarget } | { ok: false; reason: TargetContextRefusal } {
  const parsed = RuntimeDeploymentSchema.safeParse(context);
  if (!parsed.success) {
    const path = (parsed.error.issues[0]?.path ?? []).join(".");
    return { ok: false, reason: REFUSAL_BY_PATH[path] ?? "TARGET_CONTEXT_NOT_AN_OBJECT" };
  }
  const { deploy, site } = parsed.data;
  const production = deploy.context === "production";
  // A retired production bundle must not schedule today's job on old code.
  //
  // Split, because `TARGET_DEPLOYMENT_NOT_PUBLISHED` was two unrelated
  // situations under one name and the 2026-10-04 firing could not say which.
  // A production context that reports itself unpublished is either a
  // superseded bundle or a runtime that does not set `published` the way a
  // request does; a published deploy that is not production means the schedule
  // was registered somewhere other than production. They are fixed in
  // different places, so they are named apart — the same move that turned
  // `TARGET_DEPLOYMENT_UNIDENTIFIED` into something actionable.
  if (production && !deploy.published)
    return { ok: false, reason: "TARGET_DEPLOYMENT_PRODUCTION_UNPUBLISHED" };
  if (!production && deploy.published)
    return { ok: false, reason: "TARGET_DEPLOYMENT_PUBLISHED_OFF_PRODUCTION" };
  return {
    ok: true,
    target: {
      origin: `https://${deploy.id}--${site.name}.netlify.app`,
      databaseOrigin: `https://${PROJECTS[production ? "production" : "staging"]}.supabase.co`,
    },
  };
}

/** Only provider-owned runtime metadata may identify a deployed worker. */
export function nightLabRuntimeTarget(context: unknown): NightLabTarget | null {
  const explained = explainNightLabTarget(context);
  return explained.ok ? explained.target : null;
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
