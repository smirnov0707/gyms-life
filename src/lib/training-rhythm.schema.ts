import { z } from "zod";

/** Sunday is 0, matching the stable weekday mapping in local-day.ts. */
export const TrainingWeekdaySchema = z.number().int().min(0).max(6);

/**
 * A user-controlled, weekly preference—not a hard training calendar. The
 * transformation gives every downstream consumer one deterministic order.
 */
export const TrainingWeekdayListSchema = z
  .array(TrainingWeekdaySchema)
  .min(1)
  .max(7)
  .superRefine((weekdays, context) => {
    const seen = new Set<number>();
    weekdays.forEach((weekday, index) => {
      if (seen.has(weekday)) {
        context.addIssue({
          code: "custom",
          message: "Each preferred weekday can be selected only once.",
          path: [index],
        });
      }
      seen.add(weekday);
    });
  })
  .transform((weekdays) => [...weekdays].sort((left, right) => left - right));

export const TrainingRhythmInputSchema = z
  .object({ preferredWeekdays: TrainingWeekdayListSchema })
  .strict();

export const TrainingRhythmSchema = TrainingRhythmInputSchema.extend({
  updatedAt: z.string().trim().min(1),
}).strict();

const TrainingRhythmDatabaseRowSchema = z
  .object({
    preferred_weekdays: TrainingWeekdayListSchema,
    updated_at: z.string().trim().min(1),
  })
  .strict();

/** Validates a narrow Supabase selection before it becomes domain data. */
export function trainingRhythmFromDatabaseRow(value: unknown): TrainingRhythm {
  const row = TrainingRhythmDatabaseRowSchema.parse(value);
  return TrainingRhythmSchema.parse({
    preferredWeekdays: row.preferred_weekdays,
    updatedAt: row.updated_at,
  });
}

export type TrainingRhythm = z.infer<typeof TrainingRhythmSchema>;
export type TrainingRhythmInput = z.infer<typeof TrainingRhythmInputSchema>;
export type TrainingWeekday = z.infer<typeof TrainingWeekdaySchema>;
