import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveReadinessModifier } from "./readiness.engine";

export async function getTodaysReadinessModifier(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("readiness_score, load_modifier")
    .eq("user_id", userId)
    .eq("checkin_on", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) throw new Error("Daily readiness lookup failed: " + error.message);
  return resolveReadinessModifier(data);
}
