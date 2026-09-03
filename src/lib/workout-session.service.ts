import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  parseWorkoutSession,
  WORKOUT_SESSION_SELECT,
  type WorkoutSession,
} from "./workout-session.schema";
import { serializeJson } from "./json.schema";
import type { WorkoutExecutionSnapshot } from "./workout-execution.schema";

type WorkoutSessionIdentity = {
  userId: string;
  planId: string;
  dayIndex: number;
};

type NewWorkoutSession = WorkoutSessionIdentity & {
  title: string;
  adaptationModifier: number;
  workoutSnapshot: WorkoutExecutionSnapshot;
};

export async function findOpenWorkoutSession(
  supabase: SupabaseClient<Database>,
  identity: WorkoutSessionIdentity,
): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("user_id", identity.userId)
    .eq("plan_id", identity.planId)
    .eq("day_index", identity.dayIndex)
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Workout session lookup failed: " + error.message);
  }

  return data ? parseWorkoutSession(data) : null;
}

export async function createOpenWorkoutSession(
  supabase: SupabaseClient<Database>,
  input: NewWorkoutSession,
): Promise<{ session: WorkoutSession; resumed: boolean }> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: input.userId,
      plan_id: input.planId,
      day_index: input.dayIndex,
      title: input.title,
      adaptation_modifier: input.adaptationModifier,
      workout_snapshot: serializeJson(input.workoutSnapshot),
    })
    .select(WORKOUT_SESSION_SELECT)
    .single();

  if (!error && data) {
    return { session: parseWorkoutSession(data), resumed: false };
  }

  if (error?.code === "23505") {
    const existing = await findOpenWorkoutSession(supabase, input);
    if (existing) return { session: existing, resumed: true };
  }

  throw new Error("Could not start workout session: " + (error?.message ?? "unknown error"));
}
