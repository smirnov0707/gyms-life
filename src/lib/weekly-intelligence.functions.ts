import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns one deterministic, user-owned weekly intelligence review. */
export const getWeeklyIntelligenceReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.default("UTC").parse(input))
  .handler(async ({ data: timeZone, context }) => {
    const { loadWeeklyIntelligenceReview } = await import("./weekly-intelligence.service");
    return loadWeeklyIntelligenceReview(context.supabase, context.userId, timeZone);
  });
