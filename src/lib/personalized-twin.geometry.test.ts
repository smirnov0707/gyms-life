import { describe, expect, it } from "vitest";
import { buildTwinBodyGeometryEvidenceFromAthleteState } from "./personalized-twin.geometry";

describe("Personalized Twin body geometry evidence", () => {
  it("uses recent canonical body metrics as evidence without involving avatar providers", () => {
    expect(
      buildTwinBodyGeometryEvidenceFromAthleteState({
        body: {
          measurementsLast30Days: 2,
          latestWeightKg: 82.4,
          latestBodyFatPercent: 18.2,
          weightChangeKgLast30Days: -0.6,
        },
        dataGaps: [],
      }),
    ).toEqual({
      status: "observed",
      source: "canonical_body_metrics",
      providerKey: null,
      measuredAt: null,
      mayDriveBodyMetrics: true,
      medicalScan: false,
    });
  });

  it("withholds geometry authority when body measurements are unavailable", () => {
    expect(
      buildTwinBodyGeometryEvidenceFromAthleteState({
        body: {
          measurementsLast30Days: 0,
          latestWeightKg: null,
          latestBodyFatPercent: null,
          weightChangeKgLast30Days: null,
        },
        dataGaps: ["body_measurements_unavailable"],
      }),
    ).toEqual({
      status: "unknown",
      source: "none",
      providerKey: null,
      measuredAt: null,
      mayDriveBodyMetrics: false,
      medicalScan: false,
    });
  });
});
