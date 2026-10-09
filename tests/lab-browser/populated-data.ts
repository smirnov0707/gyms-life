import { LabOverviewSchema } from "@/lib/lab.schema";
import { AthleteHypothesisStatusSchema } from "@/lib/athlete-hypothesis.schema";
import { makeLabData } from "./data";

/** Deliberately synthetic measurements for presentation acceptance, never live reads. */
export function makePopulatedLabData(statusInput: string) {
  const status = AthleteHypothesisStatusSchema.parse(statusInput);
  const evidenceCount = status === "insufficient_evidence" ? 2 : status === "monitoring" ? 3 : 6;
  return LabOverviewSchema.parse({
    ...makeLabData(),
    hypotheses: [
      {
        id: "synthetic-populated-lab-hypothesis",
        domain: "training_response",
        statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
        status,
        evidenceCount,
        minimumEvidenceCount: 6,
        canInfluenceDecision: status === "supported",
        evidence: [
          { key: "rated_sessions_28d", value: 12, unit: "sessions", source: "user_reported" },
          {
            key: "usual_day_completion_rate_28d",
            value: 0.625,
            unit: "ratio",
            source: "calculated",
          },
          {
            key: "synthetic_measured_observation",
            value: 120.5,
            unit: "count",
            source: "measured",
          },
        ],
      },
    ],
  });
}
