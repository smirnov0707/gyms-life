import { z } from "zod";
import { RaceDistanceSchema } from "./endurance-activity.schema";

export const RaceGoalSchema = z
  .object({
    distance: RaceDistanceSchema,
    raceDate: z.string().date(),
    targetTimeSeconds: z.number().int().positive().max(24 * 60 * 60).nullable().default(null),
    sessionsPerWeek: z.number().int().min(2).max(7),
    longestRecentRunMeters: z.number().finite().nonnegative().max(100_000).nullable().default(null),
  })
  .strict();

export type RaceGoal = z.infer<typeof RaceGoalSchema>;

export const EnduranceSessionIntentSchema = z.enum([
  "easy",
  "long",
  "tempo",
  "intervals",
  "recovery",
  "race",
]);
export type EnduranceSessionIntent = z.infer<typeof EnduranceSessionIntentSchema>;

export const EndurancePlanSessionSchema = z
  .object({
    intent: EnduranceSessionIntentSchema,
    plannedDurationMinutes: z.number().int().positive().max(360).nullable(),
    plannedDistanceMeters: z.number().finite().positive().max(100_000).nullable(),
    intensityCue: z.string().min(1),
  })
  .strict()
  .refine(
    (session) =>
      session.plannedDurationMinutes !== null || session.plannedDistanceMeters !== null,
    "An endurance session needs a duration or distance target.",
  );

export type EndurancePlanSession = z.infer<typeof EndurancePlanSessionSchema>;
