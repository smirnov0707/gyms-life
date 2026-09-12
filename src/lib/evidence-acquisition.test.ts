import { describe, expect, it } from "vitest";
import type { AthleteHypothesis } from "./athlete-hypothesis.schema";
import { selectEvidenceAcquisitionRecommendation } from "./evidence-acquisition";

function hypothesis(overrides: Partial<AthleteHypothesis> = {}): AthleteHypothesis {
  return {
    id: "h1",
    domain: "training_response",
    status: "insufficient_evidence",
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [],
    evidenceCount: 3,
    minimumEvidenceCount: 6,
    canInfluenceDecision: false,
    ...overrides,
  };
}

describe("evidence acquisition", () => {
  it("prioritizes the closest unresolved hypothesis over generic gaps", () => {
    expect(
      selectEvidenceAcquisitionRecommendation(
        [hypothesis({ evidenceCount: 5, minimumEvidenceCount: 6 })],
        ["no_recovery_checkins_7d"],
      ),
    ).toMatchObject({
      action: "rate_next_workout",
      evidenceRemaining: 1,
      reason: "hypothesis_evidence",
    });
  });
  it("chooses the unresolved hypothesis needing the fewest additional observations", () => {
    const result = selectEvidenceAcquisitionRecommendation(
      [
        hypothesis({ id: "far", evidenceCount: 1, minimumEvidenceCount: 6 }),
        hypothesis({ id: "near", evidenceCount: 7, minimumEvidenceCount: 8 }),
      ],
      [],
    );
    expect(result).toMatchObject({ hypothesisId: "near", evidenceRemaining: 1 });
  });

  it("falls back to actionable data gaps when no hypothesis needs evidence", () => {
    const result = selectEvidenceAcquisitionRecommendation(
      [hypothesis({ status: "monitoring" })],
      ["no_body_measurements_30d", "no_recovery_checkins_7d"],
    );
    expect(result).toMatchObject({ action: "record_recovery_checkin", route: "/readiness" });
  });

  it("never invents an action for an unavailable source", () => {
    expect(selectEvidenceAcquisitionRecommendation([], ["recovery_data_unavailable"])).toBeNull();
  });
  it("routes consent gaps to Intelligence without granting decision authority", () => {
    expect(
      selectEvidenceAcquisitionRecommendation([], ["personalization_consent_required"]),
    ).toEqual({
      action: "enable_personalization",
      route: "/coach",
      hypothesisId: null,
      evidenceRemaining: null,
      reason: "consent_gap",
      decisionAuthority: false,
    });
  });
});
