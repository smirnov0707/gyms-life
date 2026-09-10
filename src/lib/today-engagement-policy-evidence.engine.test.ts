import { describe, expect, it } from "vitest";
import { summarizeTodayEngagementPolicyEvidence } from "./today-engagement-policy-evidence.engine";

describe("today engagement observational evidence", () => {
  it("summarizes both shadow arms without claiming causality", () => {
    const result = summarizeTodayEngagementPolicyEvidence([
      { comparison: "equivalent_shadow", observedCompletion: true },
      { comparison: "equivalent_shadow", observedCompletion: false },
      { comparison: "counterfactual_unobserved", observedCompletion: true },
      { comparison: "counterfactual_unobserved", observedCompletion: true },
    ]);
    expect(result.equivalent.completionRate).toBe(0.5);
    expect(result.counterfactual.completionRate).toBe(1);
    expect(result.observationalDelta).toBe(0.5);
    expect(result.causalEvidence).toBe(false);
    expect(result.promotionEligible).toBe(false);
  });

  it("withholds a delta until both observational arms exist", () => {
    const result = summarizeTodayEngagementPolicyEvidence([
      { comparison: "equivalent_shadow", observedCompletion: true },
    ]);
    expect(result.observationalDelta).toBeNull();
  });
});
