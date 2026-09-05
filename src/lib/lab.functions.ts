import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns the signed-in user's real Lab overview: hypotheses and recent decisions. */
export const getLabOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadLabOverview } = await import("./lab.service");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    return loadLabOverview(context.supabase, context.userId, timeZone);
  });
