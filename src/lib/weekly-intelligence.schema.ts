import { z } from "zod";
import { CalculatedMemoryValueSchema } from "./calculated-memory.contract";
import { DigitalAthleteDataGapSchema } from "./digital-athlete.schema";
import { UserMemoryTransparencyItemResultSchema } from "./user-memory.schema";

export const WeeklyIntelligenceActionSchema = z.enum([
  "start_training",
  "check_readiness",
  "log_nutrition",
  "log_body_metrics",
  "open_today",
]);

export type WeeklyIntelligenceAction = z.infer<typeof WeeklyIntelligenceActionSchema>;

export const WeeklyIntelligenceDiscoverySchema = UserMemoryTransparencyItemResultSchema.pick({
  type: true,
  content: true,
  source: true,
  confidence: true,
  importance: true,
  calculatedValue: true,
})
  .extend({
    source: z.literal("calculated"),
    calculatedValue: CalculatedMemoryValueSchema,
  })
  .strict();

export type WeeklyIntelligenceDiscovery = z.infer<typeof WeeklyIntelligenceDiscoverySchema>;

export const WeeklyIntelligenceReviewSchema = z
  .object({
    status: z.enum(["ready", "learning"]),
    thisWeek: z
      .object({
        completedWorkouts: z.number().int().nonnegative(),
        readinessCheckins: z.number().int().nonnegative(),
        averageReadiness: z.number().finite().min(0).max(100).nullable(),
      })
      .strict(),
    discoveries: z.array(WeeklyIntelligenceDiscoverySchema).max(3),
    nextAction: z
      .object({
        action: WeeklyIntelligenceActionSchema,
      })
      .strict(),
    stillLearning: z.array(DigitalAthleteDataGapSchema).max(10),
  })
  .strict();

export type WeeklyIntelligenceReview = z.infer<typeof WeeklyIntelligenceReviewSchema>;
