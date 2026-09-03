import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns one deterministic, user-owned weekly intelligence review. */
export const getWeeklyIntelligenceReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadWeeklyIntelligenceReview } = await import("./weekly-intelligence.service");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    return loadWeeklyIntelligenceReview(context.supabase, context.userId, timeZone);
  });
