import { describe, expect, it } from "vitest";
import { mapTwinSnapshotToVisualState } from "./digital-twin.visual-state";
import type { TwinSnapshot } from "./digital-twin.schema";

const baseSnapshot: TwinSnapshot = {
  calculationVersion: "muscle-load-v1",
  bodyVariant: "male" as const,
  computedAt: "2026-09-05T19:30:00+03:00",
  evidenceWindowDays: 14,
  dataAvailable: true,
  regions: [
    {
      region: "chest",
      provenance: "calculated",
      recoveryPct: 82,
      recoveryBand: "fresh",
      volumeKg: 3200,
      lastTrainedHoursAgo: 48,
    },
    {
      region: "quads",
      provenance: "unknown",
      recoveryPct: null,
      recoveryBand: "unknown",
      volumeKg: null,
      lastTrainedHoursAgo: null,
    },
  ],
};

describe("mapTwinSnapshotToVisualState", () => {
  it("maps canonical recovery into visual attention without inventing physiology", () => {
    const visual = mapTwinSnapshotToVisualState(baseSnapshot);
    expect(visual.version).toBe("living-twin-visual-v1");
    expect(visual.evidenceCoverage).toBe(0.5);
    expect(visual.regions.find((region) => region.region === "chest")?.attention).toBe("low");
    expect(visual.regions.find((region) => region.region === "quads")?.attention).toBe("unknown");
  });

  it("keeps the scene still when source data is unavailable", () => {
    const visual = mapTwinSnapshotToVisualState({ ...baseSnapshot, dataAvailable: false });
    expect(visual.ambientMotion).toBe("still");
    expect(visual.evidenceCoverage).toBe(0);
    expect(visual.regions.every((region) => region.attention === "unknown")).toBe(true);
  });

  it("raises visual attention when a calculated region is substantially less recovered", () => {
    const visual = mapTwinSnapshotToVisualState({
      ...baseSnapshot,
      regions: [
        {
          ...baseSnapshot.regions[0]!,
          recoveryPct: 30,
          recoveryBand: "fatigued",
        },
      ],
    });
    expect(visual.ambientMotion).toBe("active");
    expect(visual.regions[0]?.attention).toBe("high");
    expect(visual.regions[0]?.emphasis).toBeGreaterThan(0.7);
  });
});
