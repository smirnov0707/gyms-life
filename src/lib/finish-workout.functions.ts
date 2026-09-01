import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActivePlanData } from "./active-plan.service";

const Input = z.object({ sessionId: z.string().uuid() });

export const finishWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select(
        "id, user_id, plan_id, day_index, started_at, finished_at, duration_seconds, total_volume",
      )
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      throw new Error("Session lookup failed: " + sessionError.message);
    }
    if (!session) {
      throw new Error("Workout session not found.");
    }
    if (session.finished_at) {
      return { ok: true, session, alreadyFinished: true };
    }
    if (session.plan_id === null || session.day_index === null) {
      throw new Error("Workout session is missing active plan metadata.");
    }

    const plan = await getActivePlanData(supabase, userId);
    if (plan.status !== "READY" || plan.plan.id !== session.plan_id) {
      throw new Error(
        "The workout session is not linked to the current active program.",
      );
    }

    const plannedDay = plan.plan.data.days.find(
      (day) => day.day === session.day_index + 1,
    );
    if (!plannedDay) {
      throw new Error("The planned workout day could not be found.");
    }

    const { data: logs, error: logsError } = await supabase
      .from("set_logs")
      .select("id, exercise_slug, set_number, reps, weight_kg, done")
      .eq("session_id", session.id)
      .eq("user_id", userId);

    if (logsError) {
      throw new Error("Set log lookup failed: " + logsError.message);
    }

    const expected = plannedDay.exercises.reduce(
      (sum, exercise) => sum + exercise.sets,
      0,
    );
    const completed = new Set(
      logs
        .filter((log) => log.done)
        .map((log) => log.exercise_slug + ":" + log.set_number),
    );
    const expectedKeys = plannedDay.exercises.flatMap((exercise) =>
      Array.from(
        { length: exercise.sets },
        (_, index) => exercise.slug + ":" + (index + 1),
      ),
    );
    const missing = expectedKeys.filter((key) => !completed.has(key));

    if (completed.size !== expected || missing.length > 0) {
      throw new Error(
        "Cannot finish workout: " + missing.length + " planned set(s) are still incomplete.",
      );
    }

    const finishedAt = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.max(
      0,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );
    const totalVolume = logs
      .filter((log) => log.done)
      .reduce(
        (sum, log) =>
          sum + Number(log.reps ?? 0) * Number(log.weight_kg ?? 0),
        0,
      );

    const { data: updated, error: updateError } = await supabase
      .from("workout_sessions")
      .update({
        finished_at: finishedAt.toISOString(),
        duration_seconds: durationSeconds,
        total_volume: Math.round(totalVolume * 100) / 100,
      })
      .eq("id", session.id)
      .eq("user_id", userId)
      .is("finished_at", null)
      .select(
        "id, plan_id, day_index, title, started_at, finished_at, duration_seconds, total_volume",
      )
      .single();

    if (updateError || !updated) {
      throw new Error(
        "Could not finish workout: " +
          (updateError?.message ?? "session was already finished"),
      );
    }

    return {
      ok: true,
      session: updated,
      alreadyFinished: false,
    };
  });
