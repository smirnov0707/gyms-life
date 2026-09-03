import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActivePlanData } from "./active-plan.service";
import { validateWorkoutSetAgainstPlan } from "./workout-set.engine";
import { resolveWorkoutSessionDay } from "./workout-session-plan.engine";
import { parseWorkoutSession, WORKOUT_SESSION_SELECT } from "./workout-session.schema";

const Input = z.object({
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().finite().int().min(1).max(100).nullable().optional(),
  weightKg: z.coerce.number().finite().nonnegative().max(1_000).nullable().optional(),
  rpe: z.coerce.number().finite().min(1).max(10).nullable().optional(),
  done: z.boolean().default(true),
});

const setLogSelect =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

export const logWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rawSession, error: sessionError } = await supabase
      .from("workout_sessions")
      .select(WORKOUT_SESSION_SELECT)
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      throw new Error("Session lookup failed: " + sessionError.message);
    }
    if (!rawSession) {
      throw new Error("Workout session not found.");
    }
    const session = parseWorkoutSession(rawSession);
    if (session.finishedAt) {
      throw new Error("Workout session is already finished.");
    }
    if (session.planId === null || session.dayIndex === null) {
      throw new Error("Workout session is missing active plan metadata.");
    }

    const activePlan = await getActivePlanData(supabase, userId);
    if (activePlan.status !== "READY" || activePlan.plan.id !== session.planId) {
      throw new Error("Workout plan is no longer available for this session.");
    }

    const legacyPlanDay = activePlan.plan.data.days.find((day) => day.day === session.dayIndex + 1);
    const plannedDay = resolveWorkoutSessionDay(session, legacyPlanDay ?? null);
    if (!plannedDay) {
      throw new Error("The planned workout day could not be found for this session.");
    }
    validateWorkoutSetAgainstPlan(plannedDay, data);

    const { data: duplicate, error: duplicateError } = await supabase
      .from("set_logs")
      .select(setLogSelect)
      .eq("session_id", session.id)
      .eq("exercise_slug", data.exerciseSlug)
      .eq("set_number", data.setNumber)
      .maybeSingle();

    if (duplicateError) {
      throw new Error("Set lookup failed: " + duplicateError.message);
    }
    if (duplicate) {
      return { ok: true, setLog: duplicate, alreadyLogged: true };
    }

    const { data: setLog, error } = await supabase
      .from("set_logs")
      .insert({
        user_id: userId,
        session_id: session.id,
        exercise_slug: data.exerciseSlug,
        exercise_name: data.exerciseName,
        set_number: data.setNumber,
        reps: data.reps ?? null,
        weight_kg: data.weightKg ?? null,
        rpe: data.rpe ?? null,
        done: data.done,
      })
      .select(setLogSelect)
      .single();

    if (!error && setLog) {
      return { ok: true, setLog, alreadyLogged: false };
    }

    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("set_logs")
        .select(setLogSelect)
        .eq("session_id", session.id)
        .eq("exercise_slug", data.exerciseSlug)
        .eq("set_number", data.setNumber)
        .maybeSingle();

      if (existingError) {
        throw new Error("Set retry lookup failed: " + existingError.message);
      }
      if (existing) {
        return { ok: true, setLog: existing, alreadyLogged: true };
      }
    }

    throw new Error("Could not save set: " + (error?.message ?? "unknown error"));
  });
