import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";
import { getTodaysReadinessModifier } from "./readiness.service";
import { adaptTrainingPlanDay, getWorkoutTrainingGuidance } from "./training-guidance.service";
import { createOpenWorkoutSession, findOpenWorkoutSession } from "./workout-session.service";
import {
  buildWorkoutExecutionSnapshot,
  hasActiveWorkoutSafetyConstraint,
} from "./workout-execution.engine";
import { WorkoutExecutionSnapshotSchema } from "./workout-execution.schema";
import { loadActiveLifeContexts } from "./life-context.server";
import {
  parseDemonstratedExerciseCatalog,
  type ExerciseCatalogItem,
} from "./exercise-catalog.schema";

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

    let resumed = Boolean(existing);
    let session = existing;
    let executionSnapshot = existing?.workoutSnapshot ?? null;
    if (!session) {
      const adaptationModifier = await getTodaysReadinessModifier(supabase, userId);

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
        readinessModifier: adaptationModifier,
        lifeContexts: lifeContext.contexts,
        exerciseCatalog: catalog,
      });
      const started = await createOpenWorkoutSession(supabase, {
        ...identity,
        title: executionSnapshot.workout.title,
        adaptationModifier: executionSnapshot.adaptation.readinessModifier,
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
