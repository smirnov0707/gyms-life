import { describe, expect, it } from "vitest";
import { AthletePredictionSchema } from "./prediction.schema";
import { PersonalCompletionArtifactSchema } from "./personal-completion-model.schema";
import {
  buildTodayEngagementPolicyCanaryReview,
  buildTodayEngagementPolicyShadow,
} from "./today-engagement-policy.engine";
import { TodayEngagementPolicyShadowProposalSchema } from "./today-engagement-policy.schema";

const artifact = PersonalCompletionArtifactSchema.parse({
  id: "22222222-2222-4222-8222-222222222222",
  modelId: "workout-completion-personal-logit-offset",
  algorithmVersion: "0.1.0",
  sourceModelId: "workout-completion-usual-day-baseline",
  sourceModelVersion: "0.1.0",
  status: "qualified",
  trainingStartOn: "2026-08-01",
  trainedThrough: "2026-08-31",
  trainingDays: 20,
  positiveDays: 12,
  negativeDays: 8,
  evidenceFingerprint: "a".repeat(64),
  parameters: { kind: "logit_offset_v1", logOddsOffset: -0.7, ridgePenalty: 4 },
  createdAt: "2026-09-01T00:00:00Z",
});

const baseline = AthletePredictionSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  target: "workout_completion",
  generatedAt: "2026-09-15T08:00:00Z",
  horizonEndsAt: "2026-09-15T22:00:00Z",
  modelId: "workout-completion-usual-day-baseline",
  modelVersion: "0.1.0",
  maturity: "shadow",
  athleteStateSnapshotId: "33333333-3333-4333-8333-333333333333",
  evidenceLevel: "moderate",
  evidence: [],
  predicted: { kind: "probability", value: 0.5 },
  actual: null,
  evaluatedAt: null,
});

function build(overrides: Partial<Parameters<typeof buildTodayEngagementPolicyShadow>[0]> = {}) {
  return buildTodayEngagementPolicyShadow({
    artifact,
    decisionId: "55555555-5555-4555-8555-555555555555",
    decisionOn: "2026-09-15",
    decisionAction: "train_as_planned",
    athleteStateSnapshotId: "33333333-3333-4333-8333-333333333333",
    baseline,
    ...overrides,
  });
}

describe("Today engagement policy shadow", () => {
  it("proposes start-time support without taking decision authority", () => {
    const proposal = build();
    expect(proposal?.qualifiedProbability).toBeLessThan(0.45);
    expect(proposal?.candidateStrategy).toBe("choose_start_time_first");
    expect(proposal?.comparison).toBe("counterfactual_unobserved");
    expect(proposal?.safetyEnvelope).toBe("presentation_only_no_training_load_change");
    expect(proposal?.exposureState).toBe("shadow_unexposed");
    expect(proposal?.decisionAuthority).toBe(false);
  });

  it("records an equivalent shadow when the personal probability stays above threshold", () => {
    const proposal = build({
      artifact: {
        ...artifact,
        parameters: { ...artifact.parameters, logOddsOffset: 0.4 },
      },
    });
    expect(proposal?.candidateStrategy).toBe("standard_train_cta");
    expect(proposal?.comparison).toBe("equivalent_shadow");
  });

  it("requires an already-qualified forward-only artifact", () => {
    expect(build({ artifact: { ...artifact, status: "shadow" } })).toBeNull();
    expect(build({ decisionOn: artifact.trainedThrough })).toBeNull();
  });

  it("refuses mismatched source evidence and already-observed forecasts", () => {
    expect(build({ baseline: { ...baseline, modelVersion: "different" } })).toBeNull();
    expect(
      build({ athleteStateSnapshotId: "66666666-6666-4666-8666-666666666666" }),
    ).toBeNull();
    expect(
      build({
        baseline: {
          ...baseline,
          actual: { kind: "boolean", value: true },
          evaluatedAt: "2026-09-15T10:00:00Z",
        },
      }),
    ).toBeNull();
  });

  it("schema cannot be used to claim exposure or decision authority", () => {
    const proposal = build()!;
    expect(
      TodayEngagementPolicyShadowProposalSchema.safeParse({ ...proposal, decisionAuthority: true })
        .success,
    ).toBe(false);
    expect(
      TodayEngagementPolicyShadowProposalSchema.safeParse({
        ...proposal,
        comparison: "equivalent_shadow",
      }).success,
    ).toBe(false);
  });

  it("keeps canary promotion impossible without randomized exposure evidence", () => {
    expect(
      buildTodayEngagementPolicyCanaryReview({
        checked: 20,
        evaluated: 20,
        pending: 0,
        limited: false,
      }),
    ).toEqual({
      outcomeReview: { checked: 20, evaluated: 20, pending: 0, limited: false },
      readiness: {
        randomizedExposures: 0,
        causalEvidence: false,
        promotionEligible: false,
        state: "shadow_counterfactual_only",
      },
    });
  });
});