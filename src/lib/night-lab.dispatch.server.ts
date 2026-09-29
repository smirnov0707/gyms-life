import { getContext } from "@netlify/functions";
import { dispatchNightLab, type DispatchResult } from "./night-lab.dispatch";
import { nightLabRuntimeTarget, matchesNightLabDatabase } from "./night-lab.target";

type ReadSetting = (name: string) => string | undefined;
const runtimeSetting: ReadSetting = (name) => Netlify.env.get(name);

export type TargetRefusal =
  "TARGET_DEPLOYMENT_UNIDENTIFIED" | "TARGET_DATABASE_MISMATCH" | "TARGET_RESOLUTION_THREW";

/** Shared by dispatch and the receiving worker; malformed/foreign deployment fails closed. */
export function currentNightLabTarget(
  contextProvider: () => unknown = getContext,
  readSetting: ReadSetting = runtimeSetting,
): ReturnType<typeof nightLabRuntimeTarget> {
  const resolved = resolveNightLabTarget(contextProvider, readSetting);
  return resolved.ok ? resolved.target : null;
}

/**
 * The same decision, with the reason kept.
 *
 * `currentNightLabTarget` collapses three different refusals into `null`, which
 * is the right shape for a caller that only needs to fail closed and the wrong
 * one for a caller that has to explain three weeks of silence. Both exist so
 * neither has to compromise.
 */
export function resolveNightLabTarget(
  contextProvider: () => unknown = getContext,
  readSetting: ReadSetting = runtimeSetting,
):
  | { ok: true; target: NonNullable<ReturnType<typeof nightLabRuntimeTarget>> }
  | { ok: false; reason: TargetRefusal } {
  try {
    const target = nightLabRuntimeTarget(contextProvider());
    if (!target) return { ok: false, reason: "TARGET_DEPLOYMENT_UNIDENTIFIED" };
    if (!matchesNightLabDatabase(readSetting("SUPABASE_URL"), target.databaseOrigin))
      return { ok: false, reason: "TARGET_DATABASE_MISMATCH" };
    return { ok: true, target };
  } catch {
    return { ok: false, reason: "TARGET_RESOLUTION_THREW" };
  }
}

/** Adapter boundary: no Request/Host/URL fallback, no production key reuse. */
export async function dispatchCurrentNightLab(
  contextProvider: () => unknown = getContext,
  readSetting: ReadSetting = runtimeSetting,
  transport: typeof fetch = fetch,
): Promise<DispatchResult | { status: "unavailable"; reason: TargetRefusal }> {
  const resolved = resolveNightLabTarget(contextProvider, readSetting);
  if (!resolved.ok) return { status: "unavailable", reason: resolved.reason };
  return dispatchNightLab(
    { origin: resolved.target.origin, secret: readSetting("GYMSLIFE_CRON_SECRET") },
    transport,
  );
}
