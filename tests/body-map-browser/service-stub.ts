import { KNOWN_MUSCLE_GROUPS } from "../../src/lib/muscle-load.schema";
import type { TwinRegionState, TwinSnapshot } from "../../src/lib/digital-twin.schema";

const KNOWN: Record<
  string,
  Pick<TwinRegionState, "recoveryPct" | "recoveryBand" | "volumeKg" | "lastTrainedHoursAgo">
> = {
  back: { recoveryPct: 38, recoveryBand: "fatigued", volumeKg: 1500, lastTrainedHoursAgo: 36 },
  chest: { recoveryPct: 72, recoveryBand: "moderate", volumeKg: 3000, lastTrainedHoursAgo: 48 },
  arms: { recoveryPct: 88, recoveryBand: "fresh", volumeKg: 800, lastTrainedHoursAgo: 72 },
};

const SNAPSHOT: TwinSnapshot = {
  calculationVersion: "TEST-FIXTURE-NOT-USER-DATA",
  bodyVariant: "male",
  computedAt: "2026-09-07T04:00:00Z",
  evidenceWindowDays: 14,
  dataAvailable: true,
  regions: KNOWN_MUSCLE_GROUPS.map((region) => {
    const known = KNOWN[region];
    return {
      region,
      provenance: known ? "calculated" : "unknown",
      recoveryPct: known?.recoveryPct ?? null,
      recoveryBand: known?.recoveryBand ?? "unknown",
      volumeKg: known?.volumeKg ?? null,
      lastTrainedHoursAgo: known?.lastTrainedHoursAgo ?? null,
    };
  }),
};

export async function getTwinSnapshot(_input?: unknown): Promise<TwinSnapshot> {
  return SNAPSHOT;
}
