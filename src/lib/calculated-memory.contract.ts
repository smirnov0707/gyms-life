import { z } from "zod";

export const CalculatedMemoryKeySchema = z.enum([
  "derived:training_consistency_28d",
  "derived:recovery_low_7d",
  "derived:weight_change_30d",
  "derived:nutrition_logging_14d",
]);

export const CalculatedMemoryValueSchema = z.discriminatedUnion("kind", [
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
]);

export type CalculatedMemoryValue = z.infer<typeof CalculatedMemoryValueSchema>;

export const CalculatedMemoryCandidateSchema = z
  .object({
    memoryKey: CalculatedMemoryKeySchema,
    memoryType: z.enum(["training_pattern", "recovery_pattern", "nutrition_pattern", "discovery"]),
    content: z.string().trim().min(1).max(400),
    value: CalculatedMemoryValueSchema,
    confidence: z.number().finite().min(0).max(1),
    importance: z.number().finite().min(0).max(1),
  })
  .strict();

export type CalculatedMemoryCandidate = z.infer<typeof CalculatedMemoryCandidateSchema>;
