import { z } from "zod";

/**
 * A daily fluid target derived from what the athlete has actually logged.
 *
 * This is a calculated estimate from published maintenance heuristics, not a
 * measurement and not medical advice. Every component is reported with the
 * arithmetic that produced it, so the total can be checked rather than
 * trusted — and an input we do not have is named as missing instead of being
 * quietly assumed.
 */

export const HydrationComponentKeySchema = z.enum([
  "baseline",
  "training",
  "creatine",
  "stimulants",
  "protein",
]);
export type HydrationComponentKey = z.infer<typeof HydrationComponentKeySchema>;

export const HydrationComponentSchema = z
  .object({
    key: HydrationComponentKeySchema,
    ml: z.number().int(),
    /** The numbers this component came from, for the UI to show verbatim. */
    inputs: z.record(z.string(), z.number()),
  })
  .strict();
export type HydrationComponent = z.infer<typeof HydrationComponentSchema>;

export const HydrationMissingInputSchema = z.enum(["body_weight", "nutrition", "training"]);
export type HydrationMissingInput = z.infer<typeof HydrationMissingInputSchema>;

export const HydrationTargetSchema = z
  .object({
    /**
     * "personal" — derived from this athlete's own body mass and day.
     * "generic" — body weight is unknown, so this is a population default and
     * must be labelled as one rather than presented as their number.
     */
    basis: z.enum(["personal", "generic"]),
    targetMl: z.number().int().positive(),
    components: z.array(HydrationComponentSchema),
    missingInputs: z.array(HydrationMissingInputSchema),
    /** Set when the safe ceiling clipped the total, so the UI can say so. */
    cappedFromMl: z.number().int().positive().nullable(),
    /** True when the target is high enough that electrolytes matter. */
    electrolyteNote: z.boolean(),
  })
  .strict();
export type HydrationTarget = z.infer<typeof HydrationTargetSchema>;

/** What the engine needs, already read and normalised by the service. */
export const HydrationInputSchema = z
  .object({
    bodyWeightKg: z.number().positive().nullable(),
    trainingMinutesToday: z.number().nonnegative(),
    proteinGramsToday: z.number().nonnegative().nullable(),
    supplementCategories: z.array(z.string()),
  })
  .strict();
export type HydrationInput = z.infer<typeof HydrationInputSchema>;

/** Today's intake, as read back from `hydration_logs`. */
export const HydrationIntakeSchema = z
  .object({
    loggedOn: z.string().min(1),
    totalMl: z.number().int().nonnegative(),
    entries: z.array(
      z.object({
        id: z.string().uuid(),
        amountMl: z.number().int().positive(),
        consumedAt: z.string().min(1),
      }),
    ),
  })
  .strict();
export type HydrationIntake = z.infer<typeof HydrationIntakeSchema>;

/** The single amount one tap may log. Mirrors the database check. */
export const HYDRATION_MAX_ENTRY_ML = 3000;
