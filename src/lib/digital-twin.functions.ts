import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

async function resolveTwinTimeZone(
  requestedTimeZone: string | undefined,
  supabase: Parameters<typeof import("./user-context.server").loadPersistedProfileTimeZone>[0],
  userId: string,
) {
  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  return requestedTimeZone ?? (await loadPersistedProfileTimeZone(supabase, userId));
}

/** Returns the signed-in user's real Digital Twin snapshot. */
export const getTwinSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadTwinSnapshot } = await import("./digital-twin.service");
    const timeZone = await resolveTwinTimeZone(requestedTimeZone, context.supabase, context.userId);
    return loadTwinSnapshot(context.supabase, context.userId, timeZone);
  });

/** Returns one time-consistent Twin renderer + intelligence payload. */
export const getTwinExperience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadTwinExperience } = await import("./digital-twin.service");
    const timeZone = await resolveTwinTimeZone(requestedTimeZone, context.supabase, context.userId);
    return loadTwinExperience(context.supabase, context.userId, timeZone);
  });
