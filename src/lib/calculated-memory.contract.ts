import { z } from "zod";

export const CalculatedMemoryKeySchema = z.enum([
  "derived:training_consistency_28d",
  "derived:recovery_low_7d",
  "derived:weight_change_30d",
  "derived:nutrition_logging_14d",
  "derived:training_rhythm_observation_28d",
]);

export const CalculatedMemoryValueSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("training_consistency_28d"),
        sessionsLast28Days: z.number().int().min(8),
        windowDays: z.literal(28),
      })
      .strict(),
    z
      .object({
        kind: z.literal("recovery_low_7d"),
        averageReadiness: z.number().min(0).max(54.9),
        checkinsLast7Days: z.number().int().min(3),
        windowDays: z.literal(7),
      })
      .strict(),
    z
      .object({
        kind: z.literal("weight_change_30d"),
        weightChangeKg: z
          .number()
          .finite()
          .refine((value) => Math.abs(value) >= 1),
        measurementsLast30Days: z.number().int().min(2),
        windowDays: z.literal(30),
      })
      .strict(),
    z
      .object({
        kind: z.literal("nutrition_logging_14d"),
        loggedDaysLast14Days: z.number().int().min(10).max(14),
        windowDays: z.literal(14),
      })
      .strict(),
    z
      .object({
        kind: z.literal("training_rhythm_observation_28d"),
        usualTrainingDaysLast28Days: z.number().int().min(4).max(28),
        completedUsualTrainingDaysLast28Days: z.number().int().nonnegative().max(28),
        completedFlexibleTrainingDaysLast28Days: z.number().int().nonnegative().max(28),
        usualDayCompletionRateLast28Days: z.number().finite().min(0).max(1),
        windowDays: z.literal(28),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.kind === "training_rhythm_observation_28d" &&
      value.completedUsualTrainingDaysLast28Days > value.usualTrainingDaysLast28Days
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed usual days cannot exceed the available usual days.",
        path: ["completedUsualTrainingDaysLast28Days"],
      });
    }
    if (value.kind === "training_rhythm_observation_28d") {
      const expectedRate =
        Math.round(
          (value.completedUsualTrainingDaysLast28Days / value.usualTrainingDaysLast28Days) * 100,
        ) / 100;
      if (value.usualDayCompletionRateLast28Days !== expectedRate) {
        context.addIssue({
          code: "custom",
          message: "Usual-day completion rate must match the counted training days.",
          path: ["usualDayCompletionRateLast28Days"],
        });
      }
    }
  });

export type CalculatedMemoryValue = z.infer<typeof CalculatedMemoryValueSchema>;

export const CalculatedMemoryCandidateSchema = z
  .object({
    memoryKey: CalculatedMemoryKeySchema,
    memoryType: z.enum([
      "training_pattern",
      "recovery_pattern",
      "nutrition_pattern",
      "behavior",
      "discovery",
    ]),
    content: z.string().trim().min(1).max(400),
    value: CalculatedMemoryValueSchema,
    evidenceState: z.literal("calculated_threshold_met"),
    importance: z.number().finite().min(0).max(1),
  })
  .strict();

export type CalculatedMemoryCandidate = z.infer<typeof CalculatedMemoryCandidateSchema>;
