import { z } from "zod";
import type { TwinSnapshot } from "./digital-twin.schema";

/**
 * Presentation state for the Living Twin.
 *
 * This contract deliberately describes visual emphasis, not physiology.
 * `ambientMotion` is an interface treatment and MUST NOT be interpreted as
 * breathing rate, heart rate, nervous-system activity, or any other biometric.
 */
export const TwinAmbientMotionSchema = z.enum(["still", "quiet", "active"]);
export type TwinAmbientMotion = z.infer<typeof TwinAmbientMotionSchema>;

export const TwinVisualRegionSchema = z
  .object({
    region: z.string().min(1),
    attention: z.enum(["unknown", "low", "medium", "high"]),
    emphasis: z.number().min(0).max(1),
  })
  .strict();

export const TwinVisualStateSchema = z
  .object({
    version: z.literal("living-twin-visual-v1"),
    sourceCalculationVersion: z.string().min(1),
    computedAt: z.string().min(1),
    dataAvailable: z.boolean(),
    ambientMotion: TwinAmbientMotionSchema,
    evidenceCoverage: z.number().min(0).max(1),
    regions: z.array(TwinVisualRegionSchema),
  })
  .strict();

export type TwinVisualState = z.infer<typeof TwinVisualStateSchema>;

function attentionForRecovery(
  recoveryPct: number | null,
): z.infer<typeof TwinVisualRegionSchema>["attention"] {
  if (recoveryPct === null) return "unknown";
  if (recoveryPct < 45) return "high";
  if (recoveryPct < 75) return "medium";
  return "low";
}

function emphasisForRecovery(recoveryPct: number | null): number {
  if (recoveryPct === null) return 0.18;
  return Number((0.35 + ((100 - recoveryPct) / 100) * 0.65).toFixed(2));
}

/**
 * Maps the canonical renderer snapshot into a purely visual scene state.
 * No new health fact is created here.
 */
export function mapTwinSnapshotToVisualState(snapshot: TwinSnapshot): TwinVisualState {
  const evidenceCount = snapshot.regions.filter((region) => region.provenance === "calculated").length;
  const coverage = snapshot.regions.length === 0 ? 0 : evidenceCount / snapshot.regions.length;
  const calculatedRecovery = snapshot.regions
    .filter((region) => region.provenance === "calculated" && region.recoveryPct !== null)
    .map((region) => region.recoveryPct as number);
  const leastRecovered = calculatedRecovery.length > 0 ? Math.min(...calculatedRecovery) : null;

  const ambientMotion: TwinAmbientMotion = !snapshot.dataAvailable
    ? "still"
    : leastRecovered !== null && leastRecovered < 45
      ? "active"
      : evidenceCount > 0
        ? "quiet"
        : "still";

  return TwinVisualStateSchema.parse({
    version: "living-twin-visual-v1",
    sourceCalculationVersion: snapshot.calculationVersion,
    computedAt: snapshot.computedAt,
    dataAvailable: snapshot.dataAvailable,
    ambientMotion,
    evidenceCoverage: Number(coverage.toFixed(3)),
    regions: snapshot.regions.map((region) => ({
      region: region.region,
      attention: attentionForRecovery(region.recoveryPct),
      emphasis: emphasisForRecovery(region.recoveryPct),
    })),
  });
}
