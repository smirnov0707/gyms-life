import { z } from "zod";
import type { TwinSnapshot } from "./digital-twin.schema";

/** Presentation emphasis, never a breathing rate, heart rate or other biometric. */
export const TwinAmbientMotionSchema = z.enum(["still", "quiet", "active"]);
export type TwinAmbientMotion = z.infer<typeof TwinAmbientMotionSchema>;
export const TwinVisualRegionSchema = z.object({
  region: z.string().min(1),
  attention: z.enum(["unknown", "low", "medium", "high"]),
  emphasis: z.number().min(0).max(1),
}).strict();
export const TwinVisualStateSchema = z.object({
  version: z.literal("living-twin-visual-v1"),
  sourceCalculationVersion: z.string().min(1),
  computedAt: z.string().min(1),
  dataAvailable: z.boolean(),
  ambientMotion: TwinAmbientMotionSchema,
  evidenceCoverage: z.number().min(0).max(1),
  regions: z.array(TwinVisualRegionSchema),
}).strict();
export type TwinVisualState = z.infer<typeof TwinVisualStateSchema>;

/** Reuse the canonical bands, rather than inventing renderer-specific thresholds. */
export function mapTwinSnapshotToVisualState(snapshot: TwinSnapshot): TwinVisualState {
  const attentionByBand = { fresh: "low", moderate: "medium", fatigued: "high", unknown: "unknown" } as const;
  const regions = snapshot.regions.map((region) => {
    const known = region.provenance === "calculated" && region.recoveryBand !== "unknown" &&
      region.recoveryPct !== null && Number.isFinite(region.recoveryPct) && region.recoveryPct >= 0 && region.recoveryPct <= 100;
    return {
      region: region.region,
      attention: known ? attentionByBand[region.recoveryBand] : "unknown",
      emphasis: known ? Number((0.35 + ((100 - region.recoveryPct!) / 100) * 0.65).toFixed(2)) : 0.18,
    };
  });
  const evidenceCount = regions.filter((region) => region.attention !== "unknown").length;
  const ambientMotion: TwinAmbientMotion = !snapshot.dataAvailable || evidenceCount === 0 ? "still"
    : regions.some((region) => region.attention === "high") ? "active" : "quiet";
  return TwinVisualStateSchema.parse({
    version: "living-twin-visual-v1",
    sourceCalculationVersion: snapshot.calculationVersion,
    computedAt: snapshot.computedAt,
    dataAvailable: snapshot.dataAvailable,
    ambientMotion,
    evidenceCoverage: snapshot.regions.length === 0 ? 0 : Number((evidenceCount / snapshot.regions.length).toFixed(3)),
    regions,
  });
}
