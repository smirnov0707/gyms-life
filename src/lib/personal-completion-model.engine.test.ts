import { describe, expect, it } from "vitest";
import {
  buildPersonalCompletionShadowPrediction,
  evaluatePersonalCompletionHoldout,
  fitPersonalCompletionArtifact,
  personalCompletionProbability,
  personalCompletionPredictionId,
} from "./personal-completion-model.engine";
import { PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS } from "./personal-completion-model.schema";
import { AthletePredictionSchema } from "./prediction.schema";

function observations(count: number, actualRate = 0.7, probability = 0.5) {
  return Array.from({ length: count }, (_, index) => ({
    decisionOn: `2026-08-${String(index + 1).padStart(2, "0")}`,
    predictionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    generatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T08:00:00Z`,
    baselineProbability: probability,
    actual: index < Math.round(count * actualRate),
  }));
}

const baseline = AthletePredictionSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  target: "workout_completion",
  generatedAt: "2026-09-15T08:00:00Z",
  horizonEndsAt: "2026-09-15T22:00:00Z",
  modelId: "workout-completion-usual-day-baseline",
  modelVersion: "0.1.0",
  maturity: "shadow",
  athleteStateSnapshotId: null,
  evidenceLevel: "moderate",
  evidence: [],
  predicted: { kind: "probability", value: 0.5 },
  actual: null,
  evaluatedAt: null,
});
describe("personal completion model fitting", () => {
  it("withholds fitting until enough personal outcomes exist", () => {
    expect(fitPersonalCompletionArtifact(observations(11))).toBeNull();
  });

  it("requires both completion and non-completion evidence", () => {
    expect(fitPersonalCompletionArtifact(observations(12, 1))).toBeNull();
    expect(fitPersonalCompletionArtifact(observations(12, 0))).toBeNull();
  });

  it("learns a bounded positive personal offset when the athlete outperforms the baseline", () => {
    const artifact = fitPersonalCompletionArtifact(
      observations(20, 0.8, 0.5),
      "2026-09-01T00:00:00Z",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(artifact).not.toBeNull();
    expect(artifact?.trainingDays).toBe(20);
    expect(artifact?.parameters.logOddsOffset).toBeGreaterThan(0);
    expect(personalCompletionProbability(artifact!, 0.5)).toBeGreaterThan(0.5);
  });

  it("uses only the earliest baseline forecast from the same day", () => {
    const rows = observations(12, 0.5, 0.5);
    rows.push({
      ...rows[0]!,
      predictionId: "33333333-3333-4333-8333-333333333333",
      generatedAt: "2026-08-01T18:00:00Z",
      actual: !rows[0]!.actual,
    });
    const artifact = fitPersonalCompletionArtifact(rows);
    expect(artifact?.trainingDays).toBe(12);
  });
});
describe("deterministic challenger identity", () => {
  it("is stable for one artifact/decision and changes with a different decision", () => {
    const artifactId = "44444444-4444-4444-8444-444444444444";
    const firstDecision = "11111111-1111-4111-8111-111111111111";
    const one = personalCompletionPredictionId(artifactId, firstDecision);
    expect(one).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(personalCompletionPredictionId(artifactId, firstDecision)).toBe(one);
    expect(
      personalCompletionPredictionId(artifactId, "22222222-2222-4222-8222-222222222222"),
    ).not.toBe(one);
  });
});

describe("forward-only challenger prediction", () => {
  const artifact = fitPersonalCompletionArtifact(
    observations(12, 0.75, 0.5),
    "2026-09-01T00:00:00Z",
    "44444444-4444-4444-8444-444444444444",
  )!;

  it("never generates a challenger for its own training dates", () => {
    expect(
      buildPersonalCompletionShadowPrediction({
        artifact,
        baseline,
        decisionOn: artifact.trainedThrough,
      }),
    ).toBeNull();
  });

  it("generates a separate shadow forecast only after the frozen training cutoff", () => {
    const challenger = buildPersonalCompletionShadowPrediction({
      artifact,
      baseline,
      decisionOn: "2026-09-15",
      predictionId: "55555555-5555-4555-8555-555555555555",
    });
    expect(challenger?.modelId).toBe("workout-completion-personal-logit-offset");
    expect(challenger?.maturity).toBe("shadow");
    expect(challenger?.predicted.kind).toBe("probability");
    expect(challenger?.predicted).not.toEqual(baseline.predicted);
  });

  it("refuses another source model/version instead of silently recalibrating it", () => {
    expect(
      buildPersonalCompletionShadowPrediction({
        artifact,
        baseline: { ...baseline, modelVersion: "different" },
        decisionOn: "2026-09-15",
      }),
    ).toBeNull();
  });
});
describe("forward holdout qualification", () => {
  it("withholds metrics below the future-outcome threshold", () => {
    const holdout = evaluatePersonalCompletionHoldout(
      Array.from({ length: PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS - 1 }, (_, index) => ({
        decisionOn: `2026-09-${String(index + 1).padStart(2, "0")}`,
        actual: index % 2 === 0,
        baselineProbability: 0.5,
        challengerProbability: 0.6,
      })),
    );
    expect(holdout.pairedDays).toBe(PERSONAL_COMPLETION_MIN_HOLDOUT_DAYS - 1);
    expect(holdout.baselineBrier).toBeNull();
    expect(holdout.promotionEligible).toBe(false);
  });

  it("can qualify only when paired future outcomes show a positive lower confidence bound", () => {
    const pairs = Array.from({ length: 24 }, (_, index) => {
      const actual = index < 18;
      return {
        decisionOn: `2026-09-${String(index + 1).padStart(2, "0")}`,
        actual,
        baselineProbability: 0.5,
        challengerProbability: actual ? 0.82 : 0.18,
      };
    });
    const holdout = evaluatePersonalCompletionHoldout(pairs);
    expect(holdout.promotionEligible).toBe(true);
    expect(holdout.challengerBrier!).toBeLessThan(holdout.baselineBrier!);
    expect(holdout.improvementCi95Low!).toBeGreaterThan(0);
  });

  it("freezes qualification on the first 20 distinct forward days", () => {
    const firstTwenty = Array.from({ length: 20 }, (_, index) => ({
      decisionOn: `2026-09-${String(index + 1).padStart(2, "0")}`,
      actual: index < 16,
      baselineProbability: 0.5,
      challengerProbability: 0.73,
    }));
    const initial = evaluatePersonalCompletionHoldout(firstTwenty);
    const withLateAdverseDay = evaluatePersonalCompletionHoldout([
      ...firstTwenty,
      {
        decisionOn: "2026-09-21",
        actual: false,
        baselineProbability: 0.5,
        challengerProbability: 0.99,
      },
    ]);
    expect(withLateAdverseDay).toEqual(initial);
    expect(withLateAdverseDay.pairedDays).toBe(20);
  });

  it("does not qualify an apparent mean improvement whose paired confidence interval crosses zero", () => {
    const pairs = Array.from({ length: 20 }, (_, index) => ({
      decisionOn: `2026-09-${String(index + 1).padStart(2, "0")}`,
      actual: index % 2 === 0,
      baselineProbability: 0.5,
      challengerProbability:
        index < 11 ? (index % 2 === 0 ? 0.9 : 0.1) : index % 2 === 0 ? 0.3 : 0.7,
    }));
    expect(evaluatePersonalCompletionHoldout(pairs).promotionEligible).toBe(false);
  });
  it("fingerprints the exact baseline probability and generated time, not only the row identity", () => {
    const rows = observations(12, 0.67, 0.5);
    const first = fitPersonalCompletionArtifact(
      rows,
      "2026-09-09T00:00:00Z",
      "11111111-1111-4111-8111-111111111111",
    )!;
    const changed = rows.map((row, index) =>
      index === 0
        ? { ...row, baselineProbability: Math.min(0.999, row.baselineProbability + 0.01) }
        : row,
    );
    const second = fitPersonalCompletionArtifact(
      changed,
      "2026-09-09T00:00:00Z",
      "22222222-2222-4222-8222-222222222222",
    )!;
    expect(second.evidenceFingerprint).not.toBe(first.evidenceFingerprint);
  });

  it("freezes a qualified artifact instead of extending its forward holdout forever", () => {
    const fitted = fitPersonalCompletionArtifact(observations(12, 0.67, 0.5))!;
    expect(
      buildPersonalCompletionShadowPrediction({
        artifact: { ...fitted, status: "qualified" },
        baseline: {
          ...baseline,
          generatedAt: "2026-09-20T08:00:00Z",
          horizonEndsAt: "2026-09-20T22:00:00Z",
        },
        decisionOn: "2026-09-20",
      }),
    ).toBeNull();
  });
});
