import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";
import { getTodaysReadinessModifier } from "./readiness.service";
import { adaptTrainingPlanDay, getWorkoutTrainingGuidance } from "./training-guidance.service";
import { createOpenWorkoutSession, findOpenWorkoutSession } from "./workout-session.service";

const Input = z.object({ day: z.coerce.number().int().min(1) });
const setSelect =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

export const startWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workout = await getTodaysWorkoutData(supabase, userId, data.day);

    if (workout.status !== "READY") {
      throw new Error("The selected workout is not available from the active program.");
    }

    const identity = {
      userId,
      planId: workout.plan.id,
      dayIndex: data.day - 1,
    };
    const existing = await findOpenWorkoutSession(supabase, identity);
    let resumed = Boolean(existing);
    let session = existing;
    if (!session) {
      const adaptationModifier = await getTodaysReadinessModifier(supabase, userId);
      const started = await createOpenWorkoutSession(supabase, {
        ...identity,
        title: workout.workout.title,
        adaptationModifier,
      });
      session = started.session;
      resumed = started.resumed;
    }

    const adjustedWorkout = adaptTrainingPlanDay(workout.workout, session.adaptationModifier);
    let guidance: Awaited<ReturnType<typeof getWorkoutTrainingGuidance>> | null = null;
    try {
      guidance = await getWorkoutTrainingGuidance(
        supabase,
        userId,
        workout.workout,
        session.adaptationModifier,
      );
    } catch (error) {
      console.error("Workout guidance lookup failed", error);
    }

    const { data: logs, error: logsError } = await supabase
      .from("set_logs")
      .select(setSelect)
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (logsError) {
      throw new Error("Workout set lookup failed: " + logsError.message);
    }

    return {
      ok: true,
      session,
      workout: adjustedWorkout,
      guidance,
      logs: logs ?? [],
      resumed,
    };
  });
