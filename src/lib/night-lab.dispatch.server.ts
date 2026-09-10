import { getContext } from "@netlify/functions";
import { dispatchNightLab } from "./night-lab.dispatch";
import { nightLabRuntimeTarget, matchesNightLabDatabase } from "./night-lab.target";

type ReadSetting = (name: string) => string | undefined;
const runtimeSetting: ReadSetting = (name) => Netlify.env.get(name);

/** Shared by dispatch and the receiving worker; malformed/foreign deployment fails closed. */
export function currentNightLabTarget(
  contextProvider: () => unknown = getContext,
  readSetting: ReadSetting = runtimeSetting,
): ReturnType<typeof nightLabRuntimeTarget> {
  try {
    const target = nightLabRuntimeTarget(contextProvider());
    return target && matchesNightLabDatabase(readSetting("SUPABASE_URL"), target.databaseOrigin)
      ? target
      : null;
  } catch {
    return null;
  }
}

/** Adapter boundary: no Request/Host/URL fallback, no production key reuse. */
export async function dispatchCurrentNightLab(
  contextProvider: () => unknown = getContext,
  readSetting: ReadSetting = runtimeSetting,
  transport: typeof fetch = fetch,
): Promise<{ status: "queued" } | { status: "unavailable" }> {
  try {
    const target = currentNightLabTarget(contextProvider, readSetting);
    if (!target) return { status: "unavailable" };
    return dispatchNightLab(
      { origin: target.origin, secret: readSetting("GYMSLIFE_CRON_SECRET") },
      transport,
    );
  } catch {
    return { status: "unavailable" };
  }
}
