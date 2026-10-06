import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { EnduranceSessionIntentSchema } from "./endurance-race-goal.schema";

export const ConfirmRaceSessionMatchSchema = z.object({
  workoutSessionId: z.string().uuid(),
  raceGoalId: z.string().uuid(),
  planSessionKey: z.string().regex(/^w\\d+-s\\d+$/),
  intent: EnduranceSessionIntentSchema,
  matchScore: z.number().min(0).max(1).nullable(),
}).strict();

export async function confirmRaceSessionMatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  value: unknown,
) {
  const input = ConfirmRaceSessionMatchSchema.parse(value);
  const { data, error } = await supabase.from("workout_sessions").update({
    endurance_race_goal_id: input.raceGoalId,
    endurance_plan_session_key: input.planSessionKey,
    endurance_session_intent: input.intent,
    endurance_match_source: "user_confirmed",
    endurance_match_score: input.matchScore,
  }).eq("id", input.workoutSessionId).eq("user_id", userId).eq("activity_kind", "run")
    .select("id,started_at,endurance_race_goal_id,endurance_plan_session_key,endurance_session_intent,endurance_match_source").single();
  if (error) throw error;
  const { loadPersistedProfileTimeZone } = await import("./user-context.server");
  const { dayInTimeZone } = await import("./local-day");
  const { tryPersistCurrentEnduranceAdaptation } = await import("./endurance-adaptation-refresh.service");
  const timeZone = await loadPersistedProfileTimeZone(supabase, userId);
  const today = dayInTimeZone(new Date(data.started_at), timeZone);
  await tryPersistCurrentEnduranceAdaptation(supabase, userId, today, timeZone);
  return data;
}
