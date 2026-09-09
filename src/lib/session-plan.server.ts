import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorkoutSession } from "./workout-session.schema";
import { TrainingPlanDataSchema, type TrainingPlanDay } from "./training-plan.schema";
import { resolveWorkoutSessionDay } from "./workout-session-plan.engine";

/** A saved session follows its immutable snapshot, not whatever programme is active now. */
export async function loadSessionPlannedDay(
  client: SupabaseClient<Database>,
  userId: string,
  session: Pick<WorkoutSession, "dayIndex" | "adaptationModifier" | "workoutSnapshot" | "planId">,
): Promise<TrainingPlanDay | null> {
  if (session.dayIndex === null) return null;
  const plannedDayNumber = session.dayIndex + 1;
  if (session.workoutSnapshot) return resolveWorkoutSessionDay(session, null);
  if (session.planId === null) return null;
  const { data, error } = await client
    .from("plans")
    .select("data")
    .eq("id", session.planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Stored session programme could not be read.");
  if (!data) return null;
  const plan = TrainingPlanDataSchema.safeParse(data.data);
  if (!plan.success) throw new Error("Stored session programme is invalid.");
  const day = plan.data.days.find((candidate) => candidate.day === plannedDayNumber);
  return resolveWorkoutSessionDay(session, day ?? null);
}
