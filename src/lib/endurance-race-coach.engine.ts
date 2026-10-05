import type { EnduranceAdaptationDecision } from "./endurance-adaptation.engine";
import type { RaceWeekProgress } from "./endurance-race-progress.engine";

export type RaceCoachBrief = {
  headlineKey: "on_track" | "protect_recovery" | "reduce_load" | "building_evidence";
  facts: string[];
  allowedMessageIntent: "motivate" | "explain_adjustment" | "request_more_evidence";
  prohibitedClaims: string[];
};

export function buildRaceCoachBrief(input: {
  progress: RaceWeekProgress;
  adaptation: EnduranceAdaptationDecision;
}): RaceCoachBrief {
  const facts = [
    `sessions:${input.progress.completedSessions}/${input.progress.plannedSessions}`,
    input.progress.distanceCompletionRatio === null
      ? "distance_completion:unknown"
      : `distance_completion:${Math.round(input.progress.distanceCompletionRatio * 100)}%`,
    `adaptation:${input.adaptation.action}:${input.adaptation.volumeModifier}`,
  ];

  const headlineKey =
    input.progress.plannedSessions < 2 ? "building_evidence" :
    input.adaptation.action === "recover" ? "protect_recovery" :
    input.adaptation.action === "reduce" ? "reduce_load" : "on_track";

  return {
    headlineKey,
    facts,
    allowedMessageIntent:
      headlineKey === "building_evidence" ? "request_more_evidence" :
      input.adaptation.action === "hold" ? "motivate" : "explain_adjustment",
    prohibitedClaims: [
      "diagnosis",
      "injury_prediction_without_evidence",
      "guaranteed_race_time",
      "fitness_gain_not_measured",
      "override_deterministic_volume_modifier",
    ],
  };
}
