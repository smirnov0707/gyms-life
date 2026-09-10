import { describe, expect, it } from "vitest";
import { buildTodayEngagementPolicyCanaryReview } from "./today-engagement-policy-canary.engine";
import { TodayEngagementPolicyCanaryReviewSchema } from "./today-engagement-policy-canary.schema";

const protocol = {
  protocolVersion: "0.1.0" as const,
  state: "blocked" as const,
  reviewedShadowDays: 12,
  counterfactualDays: 3,
  blockers: [
    "insufficient_reviewed_shadow_days" as const,
    "insufficient_counterfactual_days" as const,
  ],
  randomizationConfigured: false as const,
  activationAllowed: false as const,
  causalEvidence: false as const,
  promotionEligible: false as const,
};

const health = {
  state: "insufficient_evidence" as const,
  recent: { reviewedDays: 0, completionRate: null },
  prior: { reviewedDays: 0, completionRate: null },
  absoluteCompletionRateDrift: null,
  canonicalFallback: "standard_train_cta" as const,
  rollbackPrepared: true as const,
  activationAllowed: false as const,
  causalEvidence: false as const,
  promotionEligible: false as const,
};

const evidence = {
  equivalent: { reviewedDays: 8, completedDays: 5, completionRate: 0.625 },
  counterfactual: { reviewedDays: 4, completedDays: 3, completionRate: 0.75 },
  observationalDelta: 0.125,
  causalEvidence: false as const,
  promotionEligible: false as const,
};

describe("today engagement policy canary guard", () => {
  it("reviews shadow outcomes without authorizing exposure", () => {
    expect(
      buildTodayEngagementPolicyCanaryReview(
        { checked: 12, evaluated: 10, limited: false },
        evidence,
        health,
        protocol,
      ),
    ).toEqual({
      outcomeReview: { checked: 12, evaluated: 10, limited: false },
      evidence,
      health,
      protocol,
      readiness: {
        randomizedExposures: 0,
        causalEvidence: false,
        promotionEligible: false,
      },
    });
  });

  it("rejects impossible outcome counts", () => {
    expect(() =>
      buildTodayEngagementPolicyCanaryReview(
        { checked: 2, evaluated: 3, limited: false },
        evidence,
        health,
        protocol,
      ),
    ).toThrow();
  });

  it("cannot be reinterpreted as a promoted or exposed policy", () => {
    const review = buildTodayEngagementPolicyCanaryReview(
      { checked: 20, evaluated: 20, limited: false },
      evidence,
      health,
      protocol,
    );
    expect(
      TodayEngagementPolicyCanaryReviewSchema.safeParse({
        ...review,
        readiness: { ...review.readiness, promotionEligible: true },
      }).success,
    ).toBe(false);
  });
});
