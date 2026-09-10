import { describe, expect, it } from "vitest";
import { buildTodayEngagementPolicyCanaryReview } from "./today-engagement-policy-canary.engine";
import { TodayEngagementPolicyCanaryReviewSchema } from "./today-engagement-policy-canary.schema";

describe("today engagement policy canary guard", () => {
  it("reviews shadow outcomes without authorizing exposure", () => {
    expect(
      buildTodayEngagementPolicyCanaryReview({ checked: 12, evaluated: 10, limited: false }),
    ).toEqual({
      outcomeReview: { checked: 12, evaluated: 10, limited: false },
      readiness: {
        randomizedExposures: 0,
        causalEvidence: false,
        promotionEligible: false,
      },
    });
  });

  it("rejects impossible outcome counts", () => {
    expect(() =>
      buildTodayEngagementPolicyCanaryReview({ checked: 2, evaluated: 3, limited: false }),
    ).toThrow();
  });

  it("cannot be reinterpreted as a promoted or exposed policy", () => {
    const review = buildTodayEngagementPolicyCanaryReview({
      checked: 20,
      evaluated: 20,
      limited: false,
    });
    expect(
      TodayEngagementPolicyCanaryReviewSchema.safeParse({
        ...review,
        readiness: { ...review.readiness, promotionEligible: true },
      }).success,
    ).toBe(false);
  });
});
