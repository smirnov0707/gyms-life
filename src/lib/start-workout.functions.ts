import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkout } from "./todays-workout.functions";

const Input = z.object({ day: z.coerce.number().int().min(1) });
const sessionSelect = "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume";
const setSelect = "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

export const startWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workout = await getTodaysWorkout({ data: { day: data.day } });

    if (workout.status !== "READY") {
      throw new Error("The selected workout is not available from the active program.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("workout_sessions")
      .select(sessionSelect)
      .eq("user_id", userId)
      .eq("plan_id", workout.plan.id)
      .eq("day_index", data.day - 1)
      .is("finished_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(`Workout session lookup failed: ${existingError.message}`);

    const session = existing ?? (await supabase
      .from("workout_sessions")
      .insert({ user_id: userId, plan_id: workout.plan.id, day_index: data.day - 1, title: workout.workout.title })
      .select(sessionSelect)
      .single()).data;

    if (!session) throw new Error("Could not start workout session.");

    const { data: logs, error: logsError } = await supabase
      .from("set_logs")
      .select(setSelect)
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (logsError) throw new Error(`Workout set lookup failed: ${logsError.message}`);

    return { ok: true as const, session, workout: workout.workout, logs: logs ?? [], resumed: Boolean(existing) };
  });