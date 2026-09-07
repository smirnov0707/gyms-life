import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";
import { buildTodaysTargets, type TodaysTargets } from "./todays-targets.engine";

/**
 * What today's session asks of the body, placed on the body.
 *
 * Two reads, and a failure in either is reported rather than absorbed: a
 * figure with nothing marked on it says "today trains nothing", which is a
 * claim, and it must only be made when both sources actually answered.
 */
export const getTodaysTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<TodaysTargets> => {
    const { getTodaysWorkoutData } = await import("./active-plan.service");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");

    const timeZone = data ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));

    let session: { title: string; exercises: TargetExercise[] } | null = null;
    let sessionReadable = true;
    try {
      const workout = await getTodaysWorkoutData(
        context.supabase,
        context.userId,
        undefined,
        timeZone,
      );
      // Only a session the athlete is meant to train today counts. A plan
      // whose weekly target is already met, or that has no workout scheduled,
      // is a rest day — not an outage, and not a body with nothing to do.
      session =
        workout.status === "READY"
          ? {
              title: workout.workout.title,
              exercises: workout.workout.exercises.map((exercise) => ({
                slug: exercise.slug,
                name: exercise.name,
                sets: exercise.sets,
                reps: String(exercise.reps),
              })),
            }
          : null;
    } catch {
      sessionReadable = false;
    }

    const { data: catalogue, error } = await context.supabase
      .from("exercises")
      .select("slug, muscle_group");

    return buildTodaysTargets({
      session,
      sessionReadable,
      // Null, not an empty map: an unread catalogue would otherwise make every
      // exercise unplaceable, which reads as a session that trains nothing we
      // can find rather than one we could not look up.
      muscleGroupBySlug: error
        ? null
        : new Map(
            z
              .array(z.object({ slug: z.string().min(1), muscle_group: z.string().min(1) }))
              .catch([])
              .parse(catalogue ?? [])
              .map((row) => [row.slug, row.muscle_group] as const),
          ),
    });
  });

type TargetExercise = { slug: string; name: string; sets: number; reps: string };
