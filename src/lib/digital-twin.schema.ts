import { z } from "zod";

export const TwinRegionRecoveryBandSchema = z.enum(["fresh", "moderate", "fatigued", "unknown"]);
export type TwinRegionRecoveryBand = z.infer<typeof TwinRegionRecoveryBandSchema>;

/**
 * One body region's state for the Digital Twin renderer. Deliberately has
 * no `layer` field yet: recovery (fatigue-decay from logged volume) is the
 * only calculated per-region signal that exists today. Add a layer axis
 * only when a second, genuinely distinct calculation exists to back it —
 * not to pre-build a taxonomy for data that isn't real yet.
 */
export const TwinRegionStateSchema = z
  .object({
    region: z.string().min(1),
    provenance: z.enum(["calculated", "unknown"]),
    recoveryPct: z.number().int().min(0).max(100).nullable(),
    recoveryBand: TwinRegionRecoveryBandSchema,
    volumeKg: z.number().nonnegative().nullable(),
    lastTrainedHoursAgo: z.number().nonnegative().nullable(),
  })
  .strict()
  .refine(
    (region) =>
      region.provenance === "calculated"
        ? region.recoveryPct !== null
        : region.recoveryPct === null && region.recoveryBand === "unknown",
    { message: "A region's provenance must match whether it actually has a calculated value." },
  );

export type TwinRegionState = z.infer<typeof TwinRegionStateSchema>;

/**
 * The Digital Twin's renderer-facing snapshot: one entry per known body
 * region, derived from (never replacing) `athlete_state_snapshots`. Not
 * itself persisted — computed on demand from the stored Digital Athlete
 * state, the same way a view is derived from a table.
 */
export const TwinSnapshotSchema = z
  .object({
    calculationVersion: z.string().min(1),
    computedAt: z.string().min(1),
    evidenceWindowDays: z.number().int().positive(),
    /** False when the underlying source query failed, not merely empty. */
    dataAvailable: z.boolean(),
    regions: z.array(TwinRegionStateSchema),
  })
  .strict();

export type TwinSnapshot = z.infer<typeof TwinSnapshotSchema>;
