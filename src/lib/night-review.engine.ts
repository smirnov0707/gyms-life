import type { AthleteModelResponse } from "./athlete-model.contract";
import type { DigitalAthleteState } from "./digital-athlete.schema";
import type {
  PersonalCompletionLearningState,
  PersonalCompletionPredictionReview,
} from "./personal-completion-model.schema";
import type { TodayEngagementPolicyCanaryReview } from "./today-engagement-policy.schema";
import { dayInTimeZone, IanaTimeZoneSchema, IsoDaySchema } from "./local-day";
import {
  NightReviewSchema,
  PredictionReviewSchema,
  HypothesisReviewSchema,
  type NightReview,
  type PredictionReview,
  type HypothesisReview,
} from "./night-review.schema";

/** Every stage returns validated evidence; no swallowed write or empty fallback is a completed stage. */
export async function buildNightReview(
  input: { runKey: string; evidenceThrough: string; timeZone: string },
  dependencies: {
    snapshot: () => Promise<AthleteModelResponse>;
    predictions: () => Promise<PredictionReview>;
    hypotheses: (state: DigitalAthleteState, snapshotId: string) => Promise<HypothesisReview>;
    modelLearning?: () => Promise<
      | PersonalCompletionLearningState
      | {
          learning: PersonalCompletionLearningState;
          predictionReview: PersonalCompletionPredictionReview;
        }
    >;
    policyCanary?: () => Promise<TodayEngagementPolicyCanaryReview>;
    now?: () => Date;
  },
): Promise<NightReview> {
  const timeZone = IanaTimeZoneSchema.parse(input.timeZone);
  const runKey = IsoDaySchema.parse(input.runKey);
  const cutoff = new Date(input.evidenceThrough);
  if (!Number.isFinite(cutoff.getTime())) throw new Error("NIGHT_REVIEW_INVALID_CUTOFF");

  let snapshot: NightReview["snapshot"] = { status: "unavailable" };
  let predictions: NightReview["predictions"] = { status: "not_run" };
  let hypotheses: NightReview["hypotheses"] = { status: "not_run" };
  let modelLearning: NonNullable<NightReview["modelLearning"]> | undefined =
    dependencies.modelLearning ? { status: "not_run" } : undefined;
  let policyCanary: NonNullable<NightReview["policyCanary"]> | undefined =
    dependencies.policyCanary ? { status: "not_run" } : undefined;
  let model: AthleteModelResponse | null = null;

  try {
    model = await dependencies.snapshot();
    snapshot = model.snapshot
      ? { status: "confirmed", id: model.snapshot.id }
      : { status: "blocked", reasons: model.state.dataGaps };
  } catch {
    /* failure is recorded, never replaced by guessed state */
  }

  if (model && snapshot.status === "confirmed") {
    try {
      predictions = {
        status: "completed",
        result: PredictionReviewSchema.parse(await dependencies.predictions()),
      };
    } catch {
      predictions = { status: "unavailable" };
    }

    try {
      hypotheses = {
        status: "completed",
        result: HypothesisReviewSchema.parse(
          await dependencies.hypotheses(model.state, snapshot.id),
        ),
      };
    } catch {
      hypotheses = { status: "unavailable" };
    }

    if (dependencies.modelLearning) {
      try {
        const raw = await dependencies.modelLearning();
        const learning = "learning" in raw ? raw.learning : raw;
        const predictionReview = "learning" in raw ? raw.predictionReview : undefined;
        modelLearning =
          learning.state === "unavailable"
            ? { status: "unavailable" }
            : {
                status: "completed",
                result: learning,
                ...(predictionReview ? { predictionReview } : {}),
              };
      } catch {
        modelLearning = { status: "unavailable" };
      }
    }

    if (dependencies.policyCanary) {
      try {
        policyCanary = { status: "completed", result: await dependencies.policyCanary() };
      } catch {
        policyCanary = { status: "unavailable" };
      }
    }
  }

  const completed =
    snapshot.status === "confirmed" &&
    predictions.status === "completed" &&
    !predictions.result.limited &&
    hypotheses.status === "completed" &&
    (modelLearning === undefined ||
      (modelLearning.status === "completed" && !modelLearning.predictionReview?.limited)) &&
    (policyCanary === undefined ||
      (policyCanary.status === "completed" && !policyCanary.result.outcomeReview.limited));

  return NightReviewSchema.parse({
    version: "1.0",
    runKey,
    timeZone,
    reviewOn: dayInTimeZone(cutoff, timeZone),
    evidenceThrough: cutoff.toISOString(),
    reviewedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    status: snapshot.status !== "confirmed" ? "blocked" : completed ? "completed" : "partial",
    snapshot,
    predictions,
    hypotheses,
    ...(modelLearning ? { modelLearning } : {}),
    ...(policyCanary ? { policyCanary } : {}),
    modelChanged: false,
    planChanged: false,
  });
}