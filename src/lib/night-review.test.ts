import { beforeEach, describe, expect, it, vi } from "vitest";
import { DigitalAthleteSourcesSchema } from "./digital-athlete.schema";
import { buildDigitalAthleteState } from "./digital-athlete.service";
import { buildNightReview } from "./night-review.engine";
import { NightReviewSchema } from "./night-review.schema";
import { buildTodayEngagementPolicyCanaryReview } from "./today-engagement-policy-canary.engine";
import { dispatchNightLab } from "./night-lab.dispatch";
const NOW = new Date("2026-09-09T06:00:00Z"),
  SNAP = "11111111-1111-4111-8111-111111111111";
const availability = Object.fromEntries(
  DigitalAthleteSourcesSchema.shape.availability.keyof().options.map((key) => [key, true]),
);
export const nightReviewTestState = () =>
  buildDigitalAthleteState(
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
    NOW,
    "Europe/Vilnius",
  );
const input = {
  runKey: "2026-09-09",
  evidenceThrough: NOW.toISOString(),
  timeZone: "Europe/Vilnius",
};
const prediction = { checked: 0, evaluated: 0, independentDays: 0, pending: 0, limited: false };
const policyReview = buildTodayEngagementPolicyCanaryReview(
  { checked: 0, evaluated: 0, limited: false },
  {
    equivalent: { reviewedDays: 0, completedDays: 0, completionRate: null },
    counterfactual: { reviewedDays: 0, completedDays: 0, completionRate: null },
    observationalDelta: null,
    causalEvidence: false,
    promotionEligible: false,
  },
  {
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
  },
);
function services() {
  return {
    snapshot: vi.fn().mockResolvedValue({
      state: nightReviewTestState(),
      evaluatedAt: NOW.toISOString(),
      snapshot: { id: SNAP, schemaVersion: "1.0", computedAt: NOW.toISOString() },
    }),
    predictions: vi.fn().mockResolvedValue(prediction),
    hypotheses: vi.fn().mockResolvedValue({ current: [], transitions: [] }),
    now: () => NOW,
  };
}
describe("confirmed overnight stage orchestration", () => {
  it("keeps policy canary as a non-exposed review guard", async () => {
    const report = await buildNightReview(input, {
      ...services(),
      policyCanary: vi.fn().mockResolvedValue(policyReview),
    });
    expect(report.status).toBe("completed");
    expect(report.policyCanary).toEqual({ status: "completed", result: policyReview });
    expect(
      report.policyCanary?.status === "completed" && report.policyCanary.result.readiness,
    ).toEqual({
      randomizedExposures: 0,
      causalEvidence: false,
      promotionEligible: false,
    });
  });

  it("treats an unavailable policy canary review as partial", async () => {
    const report = await buildNightReview(input, {
      ...services(),
      policyCanary: vi.fn().mockRejectedValue(new Error("private")),
    });
    expect(report.status).toBe("partial");
    expect(report.policyCanary).toEqual({ status: "unavailable" });
  });

  it("does not call policy canary review when the snapshot is blocked", async () => {
    const policyCanary = vi.fn();
    const deps = { ...services(), policyCanary };
    deps.snapshot.mockResolvedValue({
      state: { ...nightReviewTestState(), dataGaps: ["current_context_unavailable"] },
      snapshot: null,
    });
    const report = await buildNightReview(input, deps);
    expect(report.policyCanary).toEqual({ status: "not_run" });
    expect(policyCanary).not.toHaveBeenCalled();
  });

  it("bounded policy outcome backlog makes the night partial", async () => {
    const report = await buildNightReview(input, {
      ...services(),
      policyCanary: vi
        .fn()
        .mockResolvedValue(
          buildTodayEngagementPolicyCanaryReview(
            { checked: 64, evaluated: 64, limited: true },
            policyReview.evidence,
            policyReview.protocol,
          ),
        ),
    });
    expect(report.status).toBe("partial");
    expect(report.policyCanary).toMatchObject({
      status: "completed",
      result: { outcomeReview: { checked: 64, evaluated: 64, limited: true } },
    });
  });
  it("treats an unavailable personal-learning stage as partial while keeping other confirmed stages", async () => {
    const deps = {
      ...services(),
      modelLearning: vi.fn().mockResolvedValue({ state: "unavailable" }),
    };
    const report = await buildNightReview(input, deps);
    expect(report.status).toBe("partial");
    expect(report.modelLearning).toEqual({ status: "unavailable" });
    expect(report.predictions.status).toBe("completed");
  });

  it("does not run personal learning when the athlete snapshot is blocked", async () => {
    const learning = vi.fn();
    const deps = { ...services(), modelLearning: learning };
    deps.snapshot.mockResolvedValue({
      state: { ...nightReviewTestState(), dataGaps: ["current_context_unavailable"] },
      snapshot: null,
    });
    const report = await buildNightReview(input, deps);
    expect(report.modelLearning).toEqual({ status: "not_run" });
    expect(learning).not.toHaveBeenCalled();
  });

  it("bounded personal challenger backlog is preserved as evidence and makes the night partial", async () => {
    const deps = {
      ...services(),
      modelLearning: vi.fn().mockResolvedValue({
        learning: { state: "insufficient_history", evaluatedDays: 5, minimumTrainingDays: 12 },
        predictionReview: { checked: 64, evaluated: 64, limited: true },
      }),
    };
    const report = await buildNightReview(input, deps);
    expect(report.status).toBe("partial");
    expect(report.modelLearning).toMatchObject({
      status: "completed",
      predictionReview: { checked: 64, evaluated: 64, limited: true },
    });
  });

  it("bounded partial prediction coverage is not called a complete historical review", async () => {
    const deps = services();
    deps.predictions.mockResolvedValue({
      checked: 64,
      evaluated: 0,
      independentDays: 0,
      pending: 64,
      limited: true,
    });
    expect((await buildNightReview(input, deps)).status).toBe("partial");
  });

  it("a readable cold start is a real checked state, not invented discoveries", async () => {
    const deps = services(),
      report = await buildNightReview(input, deps);
    expect(report).toMatchObject({
      status: "completed",
      snapshot: { status: "confirmed", id: SNAP },
      predictions: { status: "completed", result: prediction },
      hypotheses: { status: "completed", result: { current: [], transitions: [] } },
      modelChanged: false,
      planChanged: false,
    });
  });
  it("unreadable source state does not become learning or a successful recalculation", async () => {
    const deps = services();
    deps.snapshot.mockResolvedValue({
      state: { ...nightReviewTestState(), dataGaps: ["body_measurements_unavailable"] },
      snapshot: null,
    });
    const report = await buildNightReview(input, deps);
    expect(report).toMatchObject({
      status: "blocked",
      snapshot: { status: "blocked", reasons: ["body_measurements_unavailable"] },
      predictions: { status: "not_run" },
      hypotheses: { status: "not_run" },
    });
    expect(deps.predictions).not.toHaveBeenCalled();
    expect(deps.hypotheses).not.toHaveBeenCalled();
  });
  it("consent restrictions do not silently enable prediction/hypothesis writes", async () => {
    const deps = services();
    deps.snapshot.mockResolvedValue({
      state: { ...nightReviewTestState(), dataGaps: ["personalization_consent_required"] },
      snapshot: null,
    });
    expect((await buildNightReview(input, deps)).status).toBe("blocked");
    expect(deps.predictions).not.toHaveBeenCalled();
  });
  it("a thrown snapshot write gives an unavailable stage and no downstream work", async () => {
    const deps = services();
    deps.snapshot.mockRejectedValue(new Error("private source details"));
    const report = await buildNightReview(input, deps);
    expect(report.snapshot.status).toBe("unavailable");
    expect(JSON.stringify(report)).not.toContain("private");
    expect(deps.hypotheses).not.toHaveBeenCalled();
  });
  it.each(["predictions", "hypotheses"] as const)(
    "a failed %s stage gives a partial receipt, not zero results",
    async (name) => {
      const deps = services();
      deps[name].mockRejectedValue(new Error("private"));
      const report = await buildNightReview(input, deps);
      expect(report.status).toBe("partial");
      expect(report[name]).toEqual({ status: "unavailable" });
      expect(report.snapshot.status).toBe("confirmed");
    },
  );
  it("rejects structurally successful but impossible stage counters", async () => {
    const deps = services();
    deps.predictions.mockResolvedValue({ ...prediction, checked: 1, evaluated: 4 });
    expect((await buildNightReview(input, deps)).predictions.status).toBe("unavailable");
  });
  it("places the receipt on the athlete local day, independent of the global UTC run key", async () => {
    const deps = services();
    deps.now = () => new Date("2026-09-09T22:30:00Z");
    const report = await buildNightReview(
      { ...input, evidenceThrough: "2026-09-09T22:00:00Z" },
      deps,
    );
    expect(report.runKey).toBe("2026-09-09");
    expect(report.reviewOn).toBe("2026-09-10");
  });
  it("a claimed model update or a successful status on blocked stages is rejected", async () => {
    const report = await buildNightReview(input, services());
    expect(NightReviewSchema.safeParse({ ...report, modelChanged: true }).success).toBe(false);
    expect(
      NightReviewSchema.safeParse({ ...report, snapshot: { status: "unavailable" } }).success,
    ).toBe(false);
  });
});
describe("short schedule dispatch, never completion", () => {
  it("dispatches to a fixed background path and accepts only the platform's queued response", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    expect(
      await dispatchNightLab(
        { origin: "https://synthetic.example", secret: "synthetic" },
        transport,
      ),
    ).toEqual({ status: "queued" });
    const [url, options] = transport.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://synthetic.example/.netlify/functions/night-lab-worker-background",
    );
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([200, 401, 500, 503])("HTTP %s cannot masquerade as queued work", async (status) => {
    expect(
      await dispatchNightLab(
        { origin: "https://synthetic.example", secret: "synthetic" },
        vi.fn().mockResolvedValue(new Response(null, { status })),
      ),
    ).toEqual({ status: "unavailable" });
  });
  it.each([
    {},
    { origin: "https://synthetic.example" },
    { origin: "http://synthetic.example", secret: "synthetic" },
    { origin: "https://user:secret@synthetic.example", secret: "synthetic" },
  ])("rejects missing/unsafe dispatcher configuration %j", async (env) => {
    const transport = vi.fn();
    expect(await dispatchNightLab(env, transport)).toEqual({ status: "unavailable" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("a transport failure remains unavailable without leaking endpoint details", async () => {
    expect(
      await dispatchNightLab(
        { origin: "https://synthetic.example", secret: "synthetic" },
        vi.fn().mockRejectedValue(new Error("private")),
      ),
    ).toEqual({ status: "unavailable" });
  });
});
