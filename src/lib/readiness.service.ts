import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";
import { StoredDailyReadinessSchema, resolveReadinessModifier } from "./readiness.engine";

export type TodayReadiness = {
  score: number;
  modifier: number;
};

/**
 * Loads one validated readiness check-in for the athlete's local calendar day.
 * Missing and malformed persistence are intentionally different outcomes: a
 * missing check-in can be collected, while malformed state must be retried.
 */
export async function getTodaysReadiness(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<TodayReadiness | null> {
  const checkinOn = dayInTimeZone(now, IanaTimeZoneSchema.parse(timeZone));
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("readiness_score, load_modifier")
    .eq("user_id", userId)
    .eq("checkin_on", checkinOn)
    .maybeSingle();

  if (error) throw new Error("Daily readiness lookup failed: " + error.message);
  if (data === null) return null;

  const parsed = StoredDailyReadinessSchema.safeParse(data);
  if (!parsed.success || parsed.data.readiness_score === null) {
    throw new Error("Daily readiness record is invalid.");
  }

  return {
    score: parsed.data.readiness_score,
    modifier: resolveReadinessModifier(parsed.data),
  };
}

export async function getTodaysReadinessModifier(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<number> {
  const readiness = await getTodaysReadiness(supabase, userId, timeZone, now);
  return readiness?.modifier ?? 1;
}
