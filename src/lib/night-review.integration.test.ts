import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DigitalAthleteSourcesSchema } from "./digital-athlete.schema";
import { buildDigitalAthleteState } from "./digital-athlete.service";
import { buildAthleteHypotheses } from "./athlete-hypothesis.service";
const io = vi.hoisted(() => ({
  snapshot: vi.fn(),
  personalReview: vi.fn(),
  personalLearning: vi.fn(),
  policyOutcomeReview: vi.fn(),
  policyProtocolReadiness: vi.fn(),
  policyEvidence: vi.fn(),
}));
vi.mock("./athlete-state-snapshot.server", () => ({ refreshAthleteStateSnapshot: io.snapshot }));
vi.mock("./personal-completion-prediction.server", () => ({
  reviewPendingPersonalCompletionPredictions: io.personalReview,
}));
vi.mock("./personal-completion-model.server", () => ({
  ensurePersonalCompletionLearning: io.personalLearning,
}));
vi.mock("./today-engagement-policy-review.server", () => ({
  reviewPendingTodayEngagementPolicyOutcomes: io.policyOutcomeReview,
  loadTodayEngagementProtocolReadiness: io.policyProtocolReadiness,
  loadTodayEngagementPolicyEvidence: io.policyEvidence,
}));
import { runAthleteNightReview, loadMorningNightReview } from "./night-review.server";
import { NightReviewSchema } from "./night-review.schema";
const U = "11111111-1111-4111-8111-111111111111",
  OTHER = "99999999-9999-4999-8999-999999999999",
  S = "22222222-2222-4222-8222-222222222222",
  D = "33333333-3333-4333-8333-333333333333",
  P = "44444444-4444-4444-8444-444444444444",
  J = "55555555-5555-4555-8555-555555555555",
  R = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-09-09T06:00:00Z"),
  input = {
    userId: U,
    runId: J,
    runKey: "2026-09-09",
    claimedAt: now.toISOString(),
    evidenceThrough: now.toISOString(),
    timeZone: "Europe/Vilnius",
  };
function model() {
  const availability = Object.fromEntries(
    DigitalAthleteSourcesSchema.shape.availability.keyof().options.map((k) => [k, true]),
  );
  const state = buildDigitalAthleteState(
    DigitalAthleteSourcesSchema.parse({
      workouts: [],
      workoutResponses: [],
      checkins: [],
      bodyMetrics: [],
      nutritionLogs: [],
      decisionFeedback: [],
      lifeContexts: [],
      trainingRhythm: null,
      setLogs: [],
      exerciseMuscleGroups: [],
      availability,
    }),
    now,
    "Europe/Vilnius",
  );
  return {
    state,
    evaluatedAt: now.toISOString(),
    snapshot: { id: S, schemaVersion: "1.0", computedAt: now.toISOString() },
  };
}
function database() {
  let prediction: unknown = {
    id: P,
    target: "workout_completion",
    generatedAt: "2026-09-08T08:00:00Z",
    horizonEndsAt: "2026-09-08T20:59:59Z",
    modelId: "completion",
    modelVersion: "1.0",
    maturity: "shadow",
    athleteStateSnapshotId: S,
    evidenceLevel: "early",
    evidence: [],
    predicted: { kind: "probability", value: 0.6 },
    actual: null,
    evaluatedAt: null,
  };
  let receipt: { id: string; user_id: string; run_id: string; report: unknown } | null = null;
  const transitions = new Map<string, unknown>(),
    calls: string[] = [];
  const controls = { failHypothesis: false, loseReceipt: false, failRead: false };
  const client = {
    from: (table: string) => {
      const equal = new Map<string, unknown>();
      let kind = "select",
        payload: unknown,
        single = false;
      const resolve = () => {
        calls.push(table + ":" + kind);
        if (equal.has("user_id") && equal.get("user_id") !== U)
          return { data: single ? null : [], error: null };
        if (table === "decision_records") {
          if (kind === "update") {
            prediction = (payload as { prediction: unknown }).prediction;
            return { data: [{ id: D }], error: null };
          }
          return { data: [{ id: D, decision_on: "2026-09-08", prediction }], error: null };
        }
        if (table === "workout_sessions")
          return { data: [{ finished_at: "2026-09-08T18:00:00Z" }], error: null };
        if (table === "personal_timeline_events") {
          if (controls.failHypothesis)
            return { data: null, error: { message: "synthetic source error" } };
          if (kind === "upsert") {
            const row = payload as { source_reference: string; summary: unknown };
            if (!transitions.has(row.source_reference))
              transitions.set(row.source_reference, row.summary);
            return { data: null, error: null };
          }
          if (single)
            return {
              data: transitions.has(String(equal.get("source_reference")))
                ? { summary: transitions.get(String(equal.get("source_reference"))) }
                : null,
              error: null,
            };
          return { data: [...transitions.values()].map((summary) => ({ summary })), error: null };
        }
        if (table === "night_lab_reviews")
          return {
            data: controls.failRead ? null : receipt,
            error: controls.failRead ? { message: "synthetic" } : null,
          };
        throw new Error("Unexpected table " + table);
      };
      const query = new Proxy(
        {},
        {
          get: (_t, key) => {
            if (key === "then")
              return (
                resolvePromise: (value: unknown) => unknown,
                rejectPromise: (error: unknown) => unknown,
              ) => Promise.resolve().then(resolve).then(resolvePromise, rejectPromise);
            return (...args: unknown[]) => {
              if (key === "eq") equal.set(String(args[0]), args[1]);
              if (key === "update" || key === "upsert") {
                kind = String(key);
                payload = args[0];
              }
              if (key === "maybeSingle") single = true;
              return query;
            };
          },
        },
      );
      return query;
    },
    rpc: vi.fn(
      async (name: string, args: { p_user_id: string; p_run_id: string; p_report: unknown }) => {
        expect(name).toBe("commit_night_lab_review");
        const report = NightReviewSchema.parse(args.p_report);
        if (!controls.loseReceipt)
          receipt = { id: R, user_id: args.p_user_id, run_id: args.p_run_id, report };
        return { data: R, error: null };
      },
    ),
  } as unknown as SupabaseClient<Database>;
  return { client, calls, controls, transitions, receipt: () => receipt };
}
beforeEach(() => {
  io.snapshot.mockReset().mockResolvedValue(model());
  io.personalReview.mockReset().mockResolvedValue({ checked: 0, evaluated: 0, limited: false });
  io.personalLearning.mockReset().mockResolvedValue({
    state: "insufficient_history",
    evaluatedDays: 1,
    minimumTrainingDays: 12,
  });
  io.policyOutcomeReview
    .mockReset()
    .mockResolvedValue({ checked: 0, evaluated: 0, limited: false });
  io.policyEvidence.mockReset().mockResolvedValue({
    equivalent: { reviewedDays: 0, completedDays: 0, completionRate: null },
    counterfactual: { reviewedDays: 0, completedDays: 0, completionRate: null },
    observationalDelta: null,
    causalEvidence: false,
    promotionEligible: false,
  });
  io.policyProtocolReadiness.mockReset().mockResolvedValue({
    protocolVersion: "0.1.0",
    state: "blocked",
    reviewedShadowDays: 0,
    counterfactualDays: 0,
    blockers: [
      "personal_model_not_qualified",
      "insufficient_reviewed_shadow_days",
      "insufficient_counterfactual_days",
    ],
    randomizationConfigured: false,
    activationAllowed: false,
    causalEvidence: false,
    promotionEligible: false,
  });
});
describe("snapshot → actual result → hypothesis ledger → receipt → morning reader", () => {
  it("connects the real review, prediction and hypothesis services and reads exactly the persisted receipt", async () => {
    const db = database(),
      saved = await runAthleteNightReview(db.client, input);
    expect(saved.review.status).toBe("completed");
    expect(saved.review.predictions).toMatchObject({
      status: "completed",
      result: { checked: 1, evaluated: 1, independentDays: 1 },
    });
    expect(saved.review.hypotheses).toMatchObject({
      status: "completed",
      result: { current: buildAthleteHypotheses(model().state) },
    });
    expect(saved.review.modelLearning).toMatchObject({
      status: "completed",
      predictionReview: { checked: 0, evaluated: 0, limited: false },
    });
    const view = await loadMorningNightReview(db.client, U, new Date("2099-01-01T00:00:00Z"));
    expect(view).toEqual({ state: "ready", reviewId: R, review: saved.review });
    const repeated = await runAthleteNightReview(db.client, input);
    expect(repeated).toEqual(saved);
    expect(io.snapshot).toHaveBeenCalledTimes(1);
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
  });
  it("records a bounded personal-prediction backlog as partial rather than calling the night complete", async () => {
    io.personalReview.mockResolvedValue({ checked: 64, evaluated: 64, limited: true });
    const db = database();
    const saved = await runAthleteNightReview(db.client, input);
    expect(saved.review.status).toBe("partial");
    expect(saved.review.modelLearning).toMatchObject({
      status: "completed",
      predictionReview: { checked: 64, evaluated: 64, limited: true },
    });
  });
  it("stops after an untrusted snapshot while retaining the blocked receipt, not fabricated zeros", async () => {
    io.snapshot.mockResolvedValue({
      ...model(),
      state: { ...model().state, dataGaps: ["current_context_unavailable"] },
      snapshot: null,
    });
    const db = database();
    const saved = await runAthleteNightReview(db.client, input);
    expect(saved.review).toMatchObject({
      status: "blocked",
      predictions: { status: "not_run" },
      hypotheses: { status: "not_run" },
    });
    expect(
      db.calls.some(
        (c) => c.startsWith("decision_records") || c.startsWith("personal_timeline_events"),
      ),
    ).toBe(false);
  });
  it("a failed secondary history stage produces a partial report with the confirmed prediction result retained", async () => {
    const db = database();
    db.controls.failHypothesis = true;
    const saved = await runAthleteNightReview(db.client, input);
    expect(saved.review.status).toBe("partial");
    expect(saved.review.hypotheses).toEqual({ status: "unavailable" });
    expect(saved.review.predictions).toMatchObject({
      status: "completed",
      result: { evaluated: 1 },
    });
  });
  it("a successful RPC without a readable matching receipt is not a saved result", async () => {
    const db = database();
    db.controls.loseReceipt = true;
    await expect(runAthleteNightReview(db.client, input)).rejects.toThrow(
      "NIGHT_REVIEW_COMMIT_UNCONFIRMED",
    );
  });
  it("the morning reader distinguishes absence, read failure and another owner's row", async () => {
    const db = database();
    expect(await loadMorningNightReview(db.client, U)).toEqual({ state: "not_run" });
    db.controls.failRead = true;
    expect(await loadMorningNightReview(db.client, U)).toEqual({ state: "unavailable" });
    db.controls.failRead = false;
    await runAthleteNightReview(db.client, input);
    expect(await loadMorningNightReview(db.client, OTHER)).toEqual({ state: "not_run" });
  });
});
