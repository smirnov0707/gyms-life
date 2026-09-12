import type { LabOverview } from "./lab.schema";
import type { DigitalAthleteDataGap } from "./digital-athlete.schema";

const ACTIONABLE_GAPS = new Set<DigitalAthleteDataGap>([
  "no_completed_workouts_28d",
  "no_recovery_checkins_7d",
  "no_body_measurements_30d",
  "no_nutrition_logs_14d",
  "personalization_consent_required",
]);

const UNAVAILABLE_GAPS = new Set<DigitalAthleteDataGap>([
  "training_data_unavailable",
  "training_response_data_unavailable",
  "recovery_data_unavailable",
  "body_measurements_unavailable",
  "nutrition_data_unavailable",
  "muscle_load_data_unavailable",
  "current_context_unavailable",
  "training_rhythm_data_unavailable",
  "decision_feedback_data_unavailable",
  "personalization_consent_unavailable",
]);

export type TwinUncertaintyMap = {
  activeLearning: number;
  actionableEvidenceGaps: number;
  unavailableSources: number;
  decisionAuthority: false;
};
export function buildTwinUncertaintyMap(lab: LabOverview | null): TwinUncertaintyMap {
  if (!lab) {
    return {
      activeLearning: 0,
      actionableEvidenceGaps: 0,
      unavailableSources: 0,
      decisionAuthority: false,
    };
  }

  const activeLearning = lab.hypotheses.filter(
    (hypothesis) =>
      hypothesis.status === "monitoring" || hypothesis.status === "insufficient_evidence",
  ).length;
  const actionableEvidenceGaps = lab.dataGaps.filter((gap) => ACTIONABLE_GAPS.has(gap)).length;
  const unavailableSources =
    lab.dataGaps.filter((gap) => UNAVAILABLE_GAPS.has(gap)).length + lab.unreadable.length;

  return {
    activeLearning,
    actionableEvidenceGaps,
    unavailableSources,
    decisionAuthority: false,
  };
}
