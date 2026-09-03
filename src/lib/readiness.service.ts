import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";
import { resolveReadinessModifier } from "./readiness.engine";

export async function getTodaysReadinessModifier(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<number> {
  const checkinOn = dayInTimeZone(now, IanaTimeZoneSchema.parse(timeZone));
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("readiness_score, load_modifier")
    .eq("user_id", userId)
    .eq("checkin_on", checkinOn)
    .maybeSingle();

  if (error) throw new Error("Daily readiness lookup failed: " + error.message);
  return resolveReadinessModifier(data);
}
