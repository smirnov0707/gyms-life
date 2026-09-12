import { z } from "zod";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import type { DigitalAthleteDataGap } from "./digital-athlete.schema";

export const EvidenceAcquisitionActionSchema = z.enum([
  "rate_next_workout",
  "complete_next_workout",
  "record_recovery_checkin",
  "log_nutrition",
  "record_body_metric",
  "enable_personalization",
]);

export const EvidenceAcquisitionRecommendationSchema = z
  .object({
    action: EvidenceAcquisitionActionSchema,
    route: z.enum(["/app", "/readiness", "/nutrition", "/twin", "/coach"]),
    hypothesisId: z.string().min(1).max(120).nullable(),
    evidenceRemaining: z.number().int().nonnegative().nullable(),
    reason: z.enum(["hypothesis_evidence", "data_gap", "consent_gap"]),
    decisionAuthority: z.literal(false),
  })
  .strict();

export type EvidenceAcquisitionRecommendation = z.infer<
  typeof EvidenceAcquisitionRecommendationSchema
>;
function hypothesisRecommendation(
  hypothesis: AthleteHypothesis,
): EvidenceAcquisitionRecommendation | null {
  if (hypothesis.status !== "insufficient_evidence") return null;
  const remaining = Math.max(hypothesis.minimumEvidenceCount - hypothesis.evidenceCount, 0);
  if (hypothesis.domain === "training_response") {
    return EvidenceAcquisitionRecommendationSchema.parse({
      action: "rate_next_workout",
      route: "/app",
      hypothesisId: hypothesis.id,
      evidenceRemaining: remaining,
      reason: "hypothesis_evidence",
      decisionAuthority: false,
    });
  }
  if (hypothesis.domain === "training_behavior") {
    return EvidenceAcquisitionRecommendationSchema.parse({
      action: "complete_next_workout",
      route: "/app",
      hypothesisId: hypothesis.id,
      evidenceRemaining: remaining,
      reason: "hypothesis_evidence",
      decisionAuthority: false,
    });
  }
  return null;
}
const DATA_GAP_ACTIONS: Partial<
  Record<
    DigitalAthleteDataGap,
    Pick<EvidenceAcquisitionRecommendation, "action" | "route" | "reason">
  >
> = {
  no_completed_workouts_28d: { action: "complete_next_workout", route: "/app", reason: "data_gap" },
  no_recovery_checkins_7d: {
    action: "record_recovery_checkin",
    route: "/readiness",
    reason: "data_gap",
  },
  no_nutrition_logs_14d: { action: "log_nutrition", route: "/nutrition", reason: "data_gap" },
  no_body_measurements_30d: {
    action: "record_body_metric",
    route: "/twin",
    reason: "data_gap",
  },
  personalization_consent_required: {
    action: "enable_personalization",
    route: "/coach",
    reason: "consent_gap",
  },
};

const DATA_GAP_PRIORITY: DigitalAthleteDataGap[] = [
  "personalization_consent_required",
  "no_completed_workouts_28d",
  "no_recovery_checkins_7d",
  "no_nutrition_logs_14d",
  "no_body_measurements_30d",
];
export function selectEvidenceAcquisitionRecommendation(
  hypotheses: readonly AthleteHypothesis[],
  dataGaps: readonly DigitalAthleteDataGap[],
): EvidenceAcquisitionRecommendation | null {
  const hypothesisCandidates = hypotheses
    .map(hypothesisRecommendation)
    .filter((item): item is EvidenceAcquisitionRecommendation => item !== null)
    .sort(
      (a, b) =>
        (a.evidenceRemaining ?? Number.MAX_SAFE_INTEGER) -
        (b.evidenceRemaining ?? Number.MAX_SAFE_INTEGER),
    );
  if (hypothesisCandidates[0]) return hypothesisCandidates[0];

  for (const gap of DATA_GAP_PRIORITY) {
    if (!dataGaps.includes(gap)) continue;
    const action = DATA_GAP_ACTIONS[gap];
    if (!action) continue;
    return EvidenceAcquisitionRecommendationSchema.parse({
      ...action,
      hypothesisId: null,
      evidenceRemaining: null,
      decisionAuthority: false,
    });
  }
  return null;
}
