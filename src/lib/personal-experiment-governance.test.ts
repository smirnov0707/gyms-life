import { describe, expect, it } from "vitest";
import {
  governPersonalExperiment,
  PersonalExperimentProtocolSchema,
} from "./personal-experiment-governance";

const base = PersonalExperimentProtocolSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  hypothesisId: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
  domain: "recovery_behavior",
  intervention: "Keep bedtime within the same 30 minute window",
  primaryOutcome: "session_feeling",
  durationDays: 14,
  changedVariableCount: 1,
  requiresMedicationChange: false,
  requiresSupplementEscalation: false,
  requiresSleepRestriction: false,
  requiresFastingBeyondNormalRoutine: false,
  stopConditions: ["Stop if the user reports feeling worse for two consecutive days"],
});

describe("personal experiment governance", () => {
  it("permits only a low-risk protocol and still grants zero decision authority", () => {
    expect(governPersonalExperiment(base)).toEqual({
      risk: "low",
      eligibleToRun: true,
      decisionAuthority: false,
      causalClaimAllowed: false,
      automaticPlanChangeAllowed: false,
      blockers: [],
    });
  });

  it("blocks medical, escalation, restriction and multi-variable experiments", () => {
    const result = governPersonalExperiment({
      ...base,
      changedVariableCount: 2,
      requiresMedicationChange: true,
      requiresSupplementEscalation: true,
      requiresSleepRestriction: true,
      requiresFastingBeyondNormalRoutine: true,
    });
    expect(result.eligibleToRun).toBe(false);
    expect(result.risk).toBe("blocked");
    expect(result.blockers).toEqual([
      "multiple_changed_variables",
      "medication_change_not_allowed",
      "supplement_escalation_not_allowed",
      "sleep_restriction_not_allowed",
      "extended_fasting_not_allowed",
    ]);
    expect(result.causalClaimAllowed).toBe(false);
  });
});
