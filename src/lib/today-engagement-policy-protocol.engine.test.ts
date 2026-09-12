import { describe, expect, it } from "vitest";
import { evaluateTodayEngagementProtocolReadiness } from "./today-engagement-policy-protocol.engine";

describe("today engagement prospective protocol readiness", () => {
  it("blocks protocol review without enough forward shadow evidence", () => {
    const result = evaluateTodayEngagementProtocolReadiness({
      personalModelQualified: true,
      reviewedShadowDays: 20,
      counterfactualDays: 4,
      outcomeBacklogClear: true,
    });
    expect(result.state).toBe("blocked");
    expect(result.blockers).toContain("insufficient_reviewed_shadow_days");
    expect(result.blockers).toContain("insufficient_counterfactual_days");
  });

  it("can become ready only for manual protocol review, never activation", () => {
    const result = evaluateTodayEngagementProtocolReadiness({
      personalModelQualified: true,
      reviewedShadowDays: 40,
      counterfactualDays: 10,
      outcomeBacklogClear: true,
    });
    expect(result.state).toBe("ready_for_manual_protocol_review");
    expect(result.randomizationConfigured).toBe(false);
    expect(result.activationAllowed).toBe(false);
    expect(result.causalEvidence).toBe(false);
    expect(result.promotionEligible).toBe(false);
  });

  it("blocks when the personal model is not qualified or outcomes are pending", () => {
    const result = evaluateTodayEngagementProtocolReadiness({
      personalModelQualified: false,
      reviewedShadowDays: 80,
      counterfactualDays: 30,
      outcomeBacklogClear: false,
    });
    expect(result.blockers).toEqual(["personal_model_not_qualified", "outcome_backlog_not_clear"]);
  });
});
