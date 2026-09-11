import type { DigitalAthleteState } from "./digital-athlete.schema";
import {
  TwinBodyGeometryEvidenceSchema,
  type TwinBodyGeometryEvidence,
} from "./personalized-twin.layers";

type GeometryStateInput = Pick<DigitalAthleteState, "body" | "dataGaps">;

export function buildTwinBodyGeometryEvidenceFromAthleteState(
  state: GeometryStateInput,
): TwinBodyGeometryEvidence {
  if (state.dataGaps.includes("body_measurements_unavailable")) {
    return TwinBodyGeometryEvidenceSchema.parse({
      status: "unknown",
      source: "none",
      providerKey: null,
      measuredAt: null,
      mayDriveBodyMetrics: false,
      medicalScan: false,
    });
  }

  const hasRecentObservedMetric =
    state.body.measurementsLast30Days > 0 &&
    (state.body.latestWeightKg !== null || state.body.latestBodyFatPercent !== null);
  if (!hasRecentObservedMetric) {
    return TwinBodyGeometryEvidenceSchema.parse({
      status: "unknown",
      source: "none",
      providerKey: null,
      measuredAt: null,
      mayDriveBodyMetrics: false,
      medicalScan: false,
    });
  }

  return TwinBodyGeometryEvidenceSchema.parse({
    status: "observed",
    source: "canonical_body_metrics",
    providerKey: null,
    measuredAt: null,
    mayDriveBodyMetrics: true,
    medicalScan: false,
  });
}
