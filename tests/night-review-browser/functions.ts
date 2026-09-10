import { currentOwner, A, B } from "../offline-browser/client";
import { NightReviewSchema } from "../../src/lib/night-review.schema";
import { DailyBriefSchema } from "../../src/lib/brief.schema";
import { dayInTimeZone } from "../../src/lib/local-day";
export { DailyBriefSchema };
const calls: { brief: number; review: number } = { brief: 0, review: 0 };
Object.assign(window, { __nightCalls: calls });
function expected(data: { ownerId: string }) {
  if (data.ownerId !== currentOwner()) throw new Error("Synthetic identity mismatch");
}
function syntheticArtifact(status: "shadow" | "qualified" = "shadow") {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    modelId: "workout-completion-personal-logit-offset",
    algorithmVersion: "0.1.0",
    sourceModelId: "workout-completion-usual-day-baseline",
    sourceModelVersion: "0.1.0",
    status,
    trainingStartOn: "2026-07-01",
    trainedThrough: "2026-08-20",
    trainingDays: 20,
    positiveDays: 15,
    negativeDays: 5,
    evidenceFingerprint: "a".repeat(64),
    parameters: { kind: "logit_offset_v1", logOddsOffset: 0.2, ridgePenalty: 4 },
    createdAt: "2026-08-20T23:00:00Z",
  };
}
export async function getMorningNightReview({ data }: { data: { ownerId: string } }) {
  calls.review++;
  expected(data);
  const params = new URLSearchParams(location.search),
    mode = params.get("mode") ?? "ready";
  if (mode === "unavailable") throw new Error("Synthetic read unavailable");
  if (mode === "none") return { state: "not_run" };
  const at = new Date(Date.now() - (mode === "stale" ? 7 * 86400000 : 0)),
    timeZone = "Europe/Vilnius";
  const report = NightReviewSchema.parse({
    version: "1.0",
    runKey: at.toISOString().slice(0, 10),
    reviewOn: dayInTimeZone(at, timeZone),
    timeZone,
    evidenceThrough: at.toISOString(),
    reviewedAt: at.toISOString(),
    status:
      mode === "partial" || mode === "model-unavailable" || mode === "learning-backlog"
        ? "partial"
        : mode === "blocked"
          ? "blocked"
          : "completed",
    snapshot:
      mode === "blocked"
        ? { status: "blocked", reasons: ["personalization_consent_required"] }
        : { status: "confirmed", id: "33333333-3333-4333-8333-333333333333" },
    predictions:
      mode === "blocked"
        ? { status: "not_run" }
        : mode === "partial"
          ? { status: "unavailable" }
          : {
              status: "completed",
              result: { checked: 2, evaluated: 2, independentDays: 1, pending: 0, limited: false },
            },
    hypotheses:
      mode === "blocked"
        ? { status: "not_run" }
        : { status: "completed", result: { current: [], transitions: [] } },
    modelLearning:
      mode === "blocked"
        ? { status: "not_run" }
        : mode === "model-unavailable"
          ? { status: "unavailable" }
          : mode === "learning" || mode === "learning-backlog"
            ? {
                status: "completed",
                result: {
                  state: "shadow_learning",
                  artifact: syntheticArtifact(),
                  holdout: {
                    pairedDays: 7,
                    positiveDays: 5,
                    negativeDays: 2,
                    baselineBrier: null,
                    challengerBrier: null,
                    meanBrierImprovement: null,
                    improvementCi95Low: null,
                    baselineLogLoss: null,
                    challengerLogLoss: null,
                    baselineCalibrationGap: null,
                    challengerCalibrationGap: null,
                    minimumHoldoutDays: 20,
                    promotionEligible: false,
                  },
                },
                predictionReview:
                  mode === "learning-backlog"
                    ? { checked: 64, evaluated: 64, limited: true }
                    : { checked: 7, evaluated: 7, limited: false },
              }
            : mode === "qualified"
              ? {
                  status: "completed",
                  result: {
                    state: "qualified_shadow",
                    artifact: syntheticArtifact("qualified"),
                    holdout: {
                      pairedDays: 20,
                      positiveDays: 15,
                      negativeDays: 5,
                      baselineBrier: 0.25,
                      challengerBrier: 0.08,
                      meanBrierImprovement: 0.17,
                      improvementCi95Low: 0.08,
                      baselineLogLoss: 0.693,
                      challengerLogLoss: 0.31,
                      baselineCalibrationGap: 0.25,
                      challengerCalibrationGap: 0.03,
                      minimumHoldoutDays: 20,
                      promotionEligible: true,
                    },
                  },
                }
              : {
                  status: "completed",
                  result: { state: "trained_shadow", artifact: syntheticArtifact() },
                },
    modelChanged: false,
    planChanged: false,
  });
  return {
    state: "ready",
    reviewId:
      data.ownerId === A
        ? "44444444-4444-4444-8444-444444444444"
        : "55555555-5555-4555-8555-555555555555",
    review: mode === "invalid" ? { ...report, modelChanged: true } : report,
  };
}
export async function getDailyBrief({ data }: { data: { ownerId: string } }) {
  calls.brief++;
  expected(data);
  const owner = data.ownerId;
  if (new URLSearchParams(location.search).get("mode") === "delayed")
    await new Promise((r) => setTimeout(r, 500));
  return DailyBriefSchema.parse({
    headline: owner === A ? "Synthetic brief A" : "Synthetic brief B",
    summary: owner === A ? "Private interpretation A" : "Private interpretation B",
    focus: "Synthetic",
    signals: [],
    actions: [],
    watchouts: [],
    gaps: [],
    streakDays: 0,
    readiness: null,
  });
}
