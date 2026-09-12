import { describe, expect, it } from "vitest";
import { evaluateTodayEngagementPolicyHealth } from "./today-engagement-policy-health.engine";

describe("today engagement policy outcome health", () => {
  it("withholds drift claims without enough reviewed outcomes", () => {
    const result = evaluateTodayEngagementPolicyHealth({
      recentOutcomes: [true, false, true],
      priorOutcomes: [true, true],
    });
    expect(result.state).toBe("insufficient_evidence");
    expect(result.absoluteCompletionRateDrift).toBeNull();
  });

  it("flags a material observational shift without granting policy authority", () => {
    const result = evaluateTodayEngagementPolicyHealth({
      recentOutcomes: Array(10).fill(false),
      priorOutcomes: Array(10).fill(true),
    });
    expect(result.state).toBe("drift_attention");
    expect(result.absoluteCompletionRateDrift).toBe(1);
    expect(result.activationAllowed).toBe(false);
    expect(result.promotionEligible).toBe(false);
  });

  it("keeps the canonical fallback prepared even when outcomes look stable", () => {
    const result = evaluateTodayEngagementPolicyHealth({
      recentOutcomes: Array(10).fill(true),
      priorOutcomes: Array(10).fill(true),
    });
    expect(result.state).toBe("stable_observation");
    expect(result.canonicalFallback).toBe("standard_train_cta");
    expect(result.rollbackPrepared).toBe(true);
    expect(result.causalEvidence).toBe(false);
  });
});
