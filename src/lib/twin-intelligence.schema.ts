import { z } from "zod";

export const TwinIntelligenceModeSchema = z.enum([
  "insufficient_evidence",
  "context_attention",
  "recovery_attention",
  "training_ready",
  "balanced",
]);

export const TwinRegionAttentionSchema = z.enum([
  "recovery_attention",
  "recent_load",
  "balanced",
  "unknown",
]);

export const TwinIntelligenceRegionSchema = z
  .object({
    region: z.string().min(1),
    recoveryPct: z.number().int().min(0).max(100).nullable(),
    volumeKg: z.number().nonnegative().nullable(),
    lastTrainedHoursAgo: z.number().nonnegative().nullable(),
    attention: TwinRegionAttentionSchema,
  })
  .strict();
export const TwinIntelligenceSchema = z
  .object({
    version: z.literal("1.0"),
    computedAt: z.string().datetime({ offset: true }),
    mode: TwinIntelligenceModeSchema,
    dataQuality: z.enum(["cold_start", "building", "informed"]),
    readiness: z.number().min(0).max(100).nullable(),
    averageReadiness7d: z.number().min(0).max(100).nullable(),
    averageSleepHours7d: z.number().min(0).max(24).nullable(),
    sessions7d: z.number().int().nonnegative(),
    sessions28d: z.number().int().nonnegative(),
    trainingVolume28d: z.number().nonnegative(),
    weightKg: z.number().nonnegative().nullable(),
    weightChangeKg30d: z.number().finite().nullable(),
    bodyFatPercent: z.number().min(0).max(100).nullable(),
    hasSafetyConstraint: z.boolean(),
    focusRegions: z.array(TwinIntelligenceRegionSchema).max(6),
    knownFacts: z.number().int().nonnegative(),
    unknownSignals: z.array(z.string().min(1)).max(16),
  })
  .strict();

export type TwinIntelligence = z.infer<typeof TwinIntelligenceSchema>;
export type TwinIntelligenceRegion = z.infer<typeof TwinIntelligenceRegionSchema>;
