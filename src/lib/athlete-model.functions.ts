import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns the user's transparent, validated Digital Athlete model. */
export const getAthleteModel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { refreshAthleteStateSnapshot } = await import("./athlete-state-snapshot.server");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    return refreshAthleteStateSnapshot(context.supabase, context.userId, timeZone);
  });
