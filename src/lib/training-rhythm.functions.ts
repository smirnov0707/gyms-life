import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";
import { TrainingRhythmInputSchema } from "./training-rhythm.schema";

const EmptyInputSchema = z.object({}).strict();

/** Returns the optional canonical rhythm preference for the authenticated athlete. */
export const getTrainingRhythm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadTrainingRhythm } = await import("./training-rhythm.server");
    return loadTrainingRhythm(context.supabase, context.userId);
  });

/** Saves a validated weekly preference; it never creates a hard workout schedule. */
export const setTrainingRhythm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => TrainingRhythmInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "training_rhythm.set",
        userId: context.userId,
        failureCode: "TRAINING_RHYTHM_SET_FAILED",
        metadata: { weekdayCount: data.preferredWeekdays.length },
      },
      async () => {
        const { saveTrainingRhythm } = await import("./training-rhythm.server");
        return saveTrainingRhythm(context.userId, data);
      },
    ),
  );

/** Clears only the optional rhythm preference. Plans and reminder settings remain unchanged. */
export const clearTrainingRhythm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => EmptyInputSchema.parse(input ?? {}))
  .handler(async ({ context }) =>
    observeServerAction(
      {
        eventName: "training_rhythm.clear",
        userId: context.userId,
        failureCode: "TRAINING_RHYTHM_CLEAR_FAILED",
        metadata: {},
      },
      async () => {
        const { clearTrainingRhythm: clear } = await import("./training-rhythm.server");
        await clear(context.userId);
        return { ok: true };
      },
    ),
  );
