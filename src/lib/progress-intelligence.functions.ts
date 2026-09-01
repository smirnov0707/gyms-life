import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProgressIntelligenceData } from "./progress-intelligence.service";

export const getProgressIntelligence = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  return getProgressIntelligenceData(context.supabase, context.userId);
});
