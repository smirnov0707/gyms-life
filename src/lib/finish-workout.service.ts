import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getActivePlanData } from "./active-plan.service";
import { evaluateWorkoutCompletion } from "./workout-completion.engine";
import { resolveWorkoutSessionDay } from "./workout-session-plan.engine";
import {
  parseCompletedWorkoutSession,
  parseWorkoutSession,
  WORKOUT_SESSION_SELECT,
  type WorkoutSession,
} from "./workout-session.schema";
import { dayInTimeZone } from "./local-day";
import { loadCompletedSessionReplay } from "./session-replay.server";

/** Application service; the server-function boundary validates input and authenticates. */
export async function finishWorkoutSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: { sessionId: string; timeZone: string },
) {
  async function readSession(): Promise<WorkoutSession> {
    const { data: raw, error } = await supabase
      .from("workout_sessions")
      .select(WORKOUT_SESSION_SELECT)
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("Session lookup failed: " + error.message);
    if (!raw) throw new Error("Workout session not found.");
    return parseWorkoutSession(raw);
  }

  const session = await readSession();
  if (session.finishedAt) {
    return {
      ok: true,
      session,
      alreadyFinished: true,
      ...(await loadCompletedSessionReplay(supabase, userId, session.id)),
    };
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
  if (!plannedDay) throw new Error("The planned workout day could not be found.");

  const { data: logs, error: logsError } = await supabase
    .from("set_logs")
    .select("id, exercise_slug, set_number, reps, weight_kg, done")
    .eq("session_id", session.id)
    .eq("user_id", userId);
  if (logsError || logs === null) {
    throw new Error("Set log lookup failed: " + (logsError?.message ?? "data unavailable"));
  }
  const completion = evaluateWorkoutCompletion(plannedDay, logs);
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
  const durationSeconds = Math.max(
    0,
    Math.round((finishedAt.getTime() - new Date(session.startedAt).getTime()) / 1000),
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
    .maybeSingle();
  if (updateError) throw new Error("Could not finish workout: " + updateError.message);
  if (!updated) {
    // Another request may have won the conditional update. Preserve its stored
    // timestamp/totals; do not report success unless a completed row now exists.
    const winner = await readSession();
    if (!winner.finishedAt) throw new Error("Could not finish workout: session is still open.");
    return {
      ok: true,
      session: winner,
      alreadyFinished: true,
      ...(await loadCompletedSessionReplay(supabase, userId, winner.id)),
    };
  }
  const savedSession = parseCompletedWorkoutSession(updated);

  // Only the winning request performs existing follow-ups. These must not turn
  // a committed workout into an apparent failure. Durable retries/outbox are
  // separate work; no claim of exactly-once event delivery is made here.
  try {
    const { completeCurrentTrainingDecision } = await import("./today-decision.server");
    await completeCurrentTrainingDecision(
      userId,
      dayInTimeZone(new Date(session.startedAt), data.timeZone),
    );
  } catch {
    console.warn("[FinishWorkout] DECISION_FOLLOWUP_FAILED");
  }
  try {
    const { recordPersonalTimelineEvent } = await import("./personal-timeline.server");
    await recordPersonalTimelineEvent(userId, {
      eventType: "workout_completed",
      occurredAt: savedSession.finishedAt,
      timeZone: data.timeZone,
      provenance: "measured",
      sourceSystem: "gymslife",
      sourceTable: "workout_sessions",
      sourceReference: session.id,
      summary: { durationSeconds, totalVolume: completion.totalVolume, dayIndex },
    });
  } catch {
    console.warn("[FinishWorkout] TIMELINE_FOLLOWUP_FAILED");
  }

  return {
    ok: true,
    session: savedSession,
    alreadyFinished: false,
    ...(await loadCompletedSessionReplay(
      supabase,
      userId,
      session.id,
      logs.map((log) => ({
        exercise_slug: log.exercise_slug,
        reps: log.reps,
        weight_kg: log.weight_kg,
        done: log.done,
      })),
    )),
  };
}
