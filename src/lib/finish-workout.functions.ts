import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActivePlanData } from "./active-plan.service";
import { evaluateWorkoutCompletion } from "./workout-completion.engine";
import { resolveWorkoutSessionDay } from "./workout-session-plan.engine";
import { parseWorkoutSession, WORKOUT_SESSION_SELECT } from "./workout-session.schema";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";

const Input = z.object({ sessionId: z.string().uuid(), timeZone: IanaTimeZoneSchema }).strict();

export const finishWorkout = createServerFn({ method: "POST" })
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
      return { ok: true, session, alreadyFinished: true, muscleBreakdown: [] };
    }
    if (session.planId === null || session.dayIndex === null) {
      throw new Error("Workout session is missing active plan metadata.");
    }
    const dayIndex = session.dayIndex;

    const plan = await getActivePlanData(supabase, userId);
    if (plan.status !== "READY" || plan.plan.id !== session.planId) {
      throw new Error("The workout session is not linked to the current active program.");
    }

    const basePlannedDay = plan.plan.data.days.find((day) => day.day === dayIndex + 1);
    const plannedDay = resolveWorkoutSessionDay(session, basePlannedDay ?? null);
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

    const completion = evaluateWorkoutCompletion(plannedDay, logs);

    // Part IX body replay: what this session actually worked. Measured from
    // the sets just logged, not modelled — recovery decay is a separate
    // question answered by muscle-load.engine over a window.
    const { data: catalogue } = await supabase.from("exercises").select("slug, muscle_group");
    const { buildSessionMuscleBreakdown } = await import("./session-muscle-breakdown");
    const muscleBreakdown = buildSessionMuscleBreakdown(
      (logs ?? []).map((log) => ({
        exercise_slug: log.exercise_slug,
        reps: log.reps,
        weight_kg: log.weight_kg,
        done: log.done,
      })),
      catalogue ?? [],
    );
    if (!completion.canFinish && completion.missingSetKeys.length > 0) {
      throw new Error(
        "Cannot finish workout: " +
          completion.missingSetKeys.length +
          " planned set(s) are still incomplete.",
      );
    }
    if (!completion.canFinish) {
      throw new Error("Cannot finish workout: unexpected completed set logs were found.");
    }

    const finishedAt = new Date();
    const startedAt = new Date(session.startedAt);
    const durationSeconds = Math.max(
      0,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );
    const { data: updated, error: updateError } = await supabase
      .from("workout_sessions")
      .update({
        finished_at: finishedAt.toISOString(),
        duration_seconds: durationSeconds,
        total_volume: completion.totalVolume,
      })
      .eq("id", session.id)
      .eq("user_id", userId)
      .is("finished_at", null)
      .select(WORKOUT_SESSION_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(
        "Could not finish workout: " + (updateError?.message ?? "session was already finished"),
      );
    }

    const { completeCurrentTrainingDecision } = await import("./today-decision.server");
    await completeCurrentTrainingDecision(
      userId,
      dayInTimeZone(new Date(session.startedAt), data.timeZone),
    );

    const { recordPersonalTimelineEvent } = await import("./personal-timeline.server");
    await recordPersonalTimelineEvent(userId, {
      eventType: "workout_completed",
      occurredAt: finishedAt.toISOString(),
      timeZone: data.timeZone,
      provenance: "measured",
      sourceSystem: "gymslife",
      sourceTable: "workout_sessions",
      sourceReference: session.id,
      summary: { durationSeconds, totalVolume: completion.totalVolume, dayIndex },
    });

    return {
      ok: true,
      session: parseWorkoutSession(updated),
      alreadyFinished: false,
      muscleBreakdown,
    };
  });
