import { describe, expect, it } from "vitest";
import { evaluateTodayEngagementPolicyShadow } from "./today-engagement-policy.engine";

const base = {
  decisionId: "11111111-1111-4111-8111-111111111111",
  decisionOn: "2026-09-10",
  decisionAction: "train_as_planned" as const,
  modelArtifactId: "22222222-2222-4222-8222-222222222222",
  sourcePredictionId: "33333333-3333-4333-8333-333333333333",
  athleteStateSnapshotId: "44444444-4444-4444-8444-444444444444",
  generatedAt: "2026-09-10T08:00:00Z",
  horizonEndsAt: "2026-09-10T22:00:00Z",
  baselineProbability: 0.52,
  qualifiedProbability: 0.52,
  personalModelQualified: true,
};

describe("today engagement policy shadow", () => {
  it("matches the persisted staging identity and safety contract", () => {
    const result = evaluateTodayEngagementPolicyShadow(base)!;
    expect(result.policyId).toBe("today-training-engagement");
    expect(result.policyVersion).toBe("0.1.0");
    expect(result.mode).toBe("shadow");
    expect(result.exposureState).toBe("shadow_unexposed");
    expect(result.decisionAuthority).toBe(false);
    expect(result.safetyEnvelope).toBe("presentation_only_no_training_load_change");
  });

  it("records an equivalent shadow comparison when the standard CTA remains", () => {
    const result = evaluateTodayEngagementPolicyShadow(base)!;
    expect(result.candidateStrategy).toBe("standard_train_cta");
    expect(result.comparison).toBe("equivalent_shadow");
  });

  it("records an unobserved counterfactual when start-time support would differ", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      qualifiedProbability: 0.31,
    })!;
    expect(result.candidateStrategy).toBe("choose_start_time_first");
    expect(result.comparison).toBe("counterfactual_unobserved");
  });

  it("does not emit a policy proposal for an unqualified personal model", () => {
    expect(
      evaluateTodayEngagementPolicyShadow({
        ...base,
        qualifiedProbability: 0.2,
        personalModelQualified: false,
      }),
    ).toBeNull();
  });

  it("uses a strict below-threshold rule at 0.45", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      qualifiedProbability: 0.45,
    })!;
    expect(result.candidateStrategy).toBe("standard_train_cta");
    expect(result.comparison).toBe("equivalent_shadow");
  });

  it("uses the database probability envelope", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      baselineProbability: 0,
      qualifiedProbability: 1,
    })!;
    expect(result.baselineProbability).toBe(0.001);
    expect(result.qualifiedProbability).toBe(0.999);
  });

  it("rejects non-finite probabilities instead of creating invalid evidence", () => {
    expect(() =>
      evaluateTodayEngagementPolicyShadow({
        ...base,
        qualifiedProbability: Number.NaN,
      }),
    ).toThrow("ENGAGEMENT_POLICY_PROBABILITY_INVALID");
  });
});
