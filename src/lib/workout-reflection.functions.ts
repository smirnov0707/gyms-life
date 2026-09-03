import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";
import { WorkoutReflectionInputSchema, parseWorkoutReflection } from "./workout-reflection.schema";

/**
 * Stores a correction-friendly, user-reported response for an already
 * completed workout. The RLS-scoped update is deliberately limited to the
 * authenticated owner's finished session; a browser never supplies a user ID.
 */
export const recordWorkoutReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => WorkoutReflectionInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "workout_reflection.record",
        userId: context.userId,
        failureCode: "WORKOUT_REFLECTION_RECORD_FAILED",
        metadata: { feeling: data.feeling },
      },
      async () => {
        const { data: saved, error } = await context.supabase
          .from("workout_sessions")
          .update({ feeling: data.feeling })
          .eq("id", data.sessionId)
          .eq("user_id", context.userId)
          .not("finished_at", "is", null)
          .select("id, feeling, finished_at")
          .maybeSingle();

        if (error) throw new Error("Could not save workout reflection.");
        if (!saved) throw new Error("Completed workout session was not found.");

        return parseWorkoutReflection(saved);
      },
    ),
  );
