import { describe, expect, it } from "vitest";
import { evaluateTodayEngagementPolicyShadow } from "./today-engagement-policy.engine";

const base = {
  baselineProbability: 0.52,
  qualifiedProbability: 0.52,
  personalModelQualified: true,
};

describe("today engagement policy shadow", () => {
  it("remains unexposed and has no decision authority", () => {
    const result = evaluateTodayEngagementPolicyShadow(base);
    expect(result.mode).toBe("shadow");
    expect(result.exposureState).toBe("shadow_unexposed");
    expect(result.decisionAuthority).toBe(false);
    expect(result.safetyEnvelope).toBe("presentation_only_no_training_load_change");
  });

  it("keeps the standard CTA when the qualified probability is not low", () => {
    const result = evaluateTodayEngagementPolicyShadow(base);
    expect(result.candidateStrategy).toBe("standard_train_cta");
    expect(result.comparison).toBe("baseline_retained");
  });

  it("prefers start-time support only for a qualified low completion probability", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      qualifiedProbability: 0.31,
    });
    expect(result.candidateStrategy).toBe("choose_start_time_first");
    expect(result.comparison).toBe("candidate_preferred");
  });

  it("does not use an unqualified personal model even when its probability is low", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      qualifiedProbability: 0.2,
      personalModelQualified: false,
    });
    expect(result.candidateStrategy).toBe("standard_train_cta");
    expect(result.comparison).toBe("baseline_retained");
  });

  it("uses a strict below-threshold rule at the policy boundary", () => {
    const result = evaluateTodayEngagementPolicyShadow({
      ...base,
      qualifiedProbability: 0.45,
    });
    expect(result.candidateStrategy).toBe("standard_train_cta");
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
