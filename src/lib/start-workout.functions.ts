import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";
import { getTodaysReadiness } from "./readiness.service";
import { adaptTrainingPlanDay, getWorkoutTrainingGuidance } from "./training-guidance.service";
import { createOpenWorkoutSession, findOpenWorkoutSession } from "./workout-session.service";
import {
  buildWorkoutExecutionSnapshot,
  hasActiveWorkoutSafetyConstraint,
} from "./workout-execution.engine";
import {
  WorkoutExecutionSnapshotSchema,
  loadModifierForWorkoutAdaptation,
} from "./workout-execution.schema";
import { loadActiveLifeContexts } from "./life-context.server";
import { loadDigitalAthleteState } from "./digital-athlete.service";
import { resolveTrainingResponseVolumeGuard } from "./training-response.engine";
import {
  parseDemonstratedExerciseCatalog,
  type ExerciseCatalogItem,
} from "./exercise-catalog.schema";
import { IanaTimeZoneSchema } from "./local-day";
import { evaluateWorkoutStartGate, type WorkoutStartRejection } from "./workout-start.gate";

const Input = z
  .object({ day: z.coerce.number().int().min(1), timeZone: IanaTimeZoneSchema })
  .strict();
const setSelect =
  "id, session_id, exercise_slug, exercise_name, set_number, reps, weight_kg, rpe, done, created_at";

function workoutStartMessage(reason: WorkoutStartRejection): string {
  if (reason === "readiness_required") {
    return "Complete today's readiness check-in before starting a new workout.";
  }
  if (reason === "not_next_workout") {
    return "This is not the next workout in your active program. Return to Today to continue safely.";
  }
  return "The next workout is not available today. Return to Today for the current recommendation.";
}

export const startWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workout = await getTodaysWorkoutData(supabase, userId, undefined, data.timeZone);

    if (workout.status !== "READY") {
      throw new Error(workoutStartMessage("workout_unavailable"));
    }

    const identity = {
      userId,
      planId: workout.plan.id,
      dayIndex: data.day - 1,
    };
    const [existing, lifeContext] = await Promise.all([
      findOpenWorkoutSession(supabase, identity),
      loadActiveLifeContexts(supabase, userId),
    ]);
    if (!lifeContext.available) {
      throw new Error("Current life context is temporarily unavailable. Please try again shortly.");
    }
    if (hasActiveWorkoutSafetyConstraint(lifeContext.contexts)) {
      throw new Error(
        "Training is paused while a temporary limitation is active. Review recovery or remove the context when it no longer applies.",
      );
    }

    let todaysReadiness = null;
    let trainingResponseModifier = 1;
    if (!existing) {
      const [readiness, athleteState] = await Promise.all([
        getTodaysReadiness(supabase, userId, data.timeZone),
        loadDigitalAthleteState(supabase, userId, undefined, data.timeZone),
      ]);
      todaysReadiness = readiness;
      trainingResponseModifier = resolveTrainingResponseVolumeGuard(
        athleteState.training.selfReportedResponse,
      ).volumeModifier;
    }

    const entryGate = evaluateWorkoutStartGate({
      availability: { status: "ready", nextWorkoutDay: workout.workout.day },
      requestedDay: data.day,
      hasOpenSession: Boolean(existing),
      hasTodayReadiness: todaysReadiness !== null,
    });
    if (!entryGate.allowed) throw new Error(workoutStartMessage(entryGate.reason));

    let resumed = Boolean(existing);
    let session = existing;
    let executionSnapshot = existing?.workoutSnapshot ?? null;
    if (!session) {
      if (todaysReadiness === null) {
        throw new Error("Complete today's readiness check-in before starting a new workout.");
      }
      const needsEquipmentCatalog = lifeContext.contexts.some(
        (context) =>
          context.context.kind === "travel" ||
          context.context.kind === "equipment_limited" ||
          context.context.kind === "facility_closed",
      );
      let catalog: ExerciseCatalogItem[] = [];
      if (needsEquipmentCatalog) {
        const { data, error } = await supabase
          .from("exercises")
          .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty");
        if (error)
          throw new Error("Exercise catalog is temporarily unavailable. Please try again.");
        catalog = parseDemonstratedExerciseCatalog(data);
        if (catalog.length === 0) {
          throw new Error("Exercise catalog is temporarily unavailable. Please try again.");
        }
      }

      executionSnapshot = buildWorkoutExecutionSnapshot({
        day: workout.workout,
        readinessModifier: todaysReadiness.modifier,
        trainingResponseModifier,
        lifeContexts: lifeContext.contexts,
        exerciseCatalog: catalog,
      });
      const started = await createOpenWorkoutSession(supabase, {
        ...identity,
        title: executionSnapshot.workout.title,
        adaptationModifier: loadModifierForWorkoutAdaptation(executionSnapshot.adaptation),
        workoutSnapshot: executionSnapshot,
      });
      session = started.session;
      resumed = started.resumed;
      executionSnapshot = session.workoutSnapshot ?? executionSnapshot;
    }

    const snapshot =
      executionSnapshot ??
      WorkoutExecutionSnapshotSchema.parse({
        version: "1.0",
        workout: adaptTrainingPlanDay(workout.workout, session.adaptationModifier),
        adaptation: {
          version: "1.0",
          readinessModifier: session.adaptationModifier,
          reasons: [],
          sourceContextIds: [],
          timeBudgetMinutes: null,
          substitutions: [],
          omittedExerciseSlugs: [],
        },
      });
    let guidance: Awaited<ReturnType<typeof getWorkoutTrainingGuidance>> | null = null;
    try {
      guidance = await getWorkoutTrainingGuidance(
        supabase,
        userId,
        snapshot.workout,
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
      workout: snapshot.workout,
      adaptation: snapshot.adaptation,
      guidance,
      logs: logs ?? [],
      resumed,
    };
  });
