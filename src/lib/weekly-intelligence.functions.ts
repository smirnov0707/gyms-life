import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns one deterministic, user-owned weekly intelligence review. */
export const getWeeklyIntelligenceReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadWeeklyIntelligenceReview } = await import("./weekly-intelligence.service");
    return loadWeeklyIntelligenceReview(context.supabase, context.userId);
  });
