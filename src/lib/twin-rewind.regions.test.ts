import { describe, expect, it } from "vitest";
import type { TwinSnapshot } from "./digital-twin.schema";
import { compareTwinRewindRegions, type TwinRewindPoint } from "./twin-rewind";

function snapshot(
  recoveryPct: number | null,
  volumeKg: number | null,
  dataAvailable = true,
): TwinSnapshot {
  return {
    calculationVersion: "digital-athlete-v2",
    computedAt: "2026-09-06T10:00:00.000Z",
    evidenceWindowDays: 7,
    dataAvailable,
    regions: [
      recoveryPct === null
        ? {
            region: "chest",
            provenance: "unknown",
            recoveryPct: null,
            recoveryBand: "unknown",
            volumeKg: null,
            lastTrainedHoursAgo: null,
          }
        : {
            region: "chest",
            provenance: "calculated",
            recoveryPct,
            recoveryBand: recoveryPct >= 75 ? "fresh" : recoveryPct >= 40 ? "moderate" : "fatigued",
            volumeKg,
            lastTrainedHoursAgo: 12,
          },
    ],
  };
}

function point(
  id: string,
  twin: TwinSnapshot | null,
  overrides: Partial<TwinRewindPoint> = {},
): TwinRewindPoint {
  return {
    id,
    computedAt: "2026-09-06T10:00:00Z",
    calculationVersion: "digital-athlete-v2",
    schemaVersion: "1.7",
    sourceWindowStart: null,
    sourceWindowEnd: null,
    compatible: true,
    dataQualityLevel: "informed",
    metrics: {
      sessionsLast7Days: 2,
      totalVolumeLast28Days: 1000,
      readiness: 70,
      sleepHours: 7,
      weightKg: 80,
      calories: 2200,
      proteinG: 150,
      evidenceCount: 20,
    },
    twin,
    ...overrides,
  };
}

describe("Twin Rewind region comparison", () => {
  it("computes signed region differences from newer minus older stored states", () => {
    const deltas = compareTwinRewindRegions(
      point("00000000-0000-4000-8000-000000000001", snapshot(60, 100)),
      point("00000000-0000-4000-8000-000000000002", snapshot(72, 145)),
    );
    expect(deltas?.[0]).toEqual({
      region: "chest",
      recoveryPctDelta: 12,
      volumeKgDelta: 45,
      olderRecoveryPct: 60,
      newerRecoveryPct: 72,
      olderVolumeKg: 100,
      newerVolumeKg: 145,
    });
  });

  it("keeps a region difference unknown when either stored state lacks evidence", () => {
    const deltas = compareTwinRewindRegions(
      point("00000000-0000-4000-8000-000000000001", snapshot(null, null)),
      point("00000000-0000-4000-8000-000000000002", snapshot(72, 145)),
    );
    expect(deltas?.[0]).toMatchObject({ recoveryPctDelta: null, volumeKgDelta: null });
  });

  it("refuses to compare states produced by different model identities", () => {
    const older = point("00000000-0000-4000-8000-000000000001", snapshot(60, 100), {
      calculationVersion: "digital-athlete-v1",
    });
    const newer = point("00000000-0000-4000-8000-000000000002", snapshot(72, 145));
    expect(compareTwinRewindRegions(older, newer)).toBeNull();
  });

  it("refuses a region map when either Twin source was unavailable", () => {
    const older = point("00000000-0000-4000-8000-000000000001", snapshot(60, 100, false));
    const newer = point("00000000-0000-4000-8000-000000000002", snapshot(72, 145));
    expect(compareTwinRewindRegions(older, newer)).toBeNull();
  });

  it("does not compare an incompatible snapshot even when a Twin payload is present", () => {
    const older = point("00000000-0000-4000-8000-000000000001", snapshot(60, 100), {
      compatible: false,
    });
    const newer = point("00000000-0000-4000-8000-000000000002", snapshot(72, 145));
    expect(compareTwinRewindRegions(older, newer)).toBeNull();
  });
});
