import { describe, expect, it, vi } from "vitest";
import { DigitalAthleteSourcesSchema } from "./digital-athlete.schema";
import { buildDigitalAthleteState } from "./digital-athlete.service";
import { buildNightReview } from "./night-review.engine";
import { NightReviewSchema } from "./night-review.schema";
import { buildTodayEngagementPolicyCanaryReview } from "./today-engagement-policy.engine";

const NOW = new Date("2026-09-10T06:00:00Z");
const SNAPSHOT = "11111111-1111-4111-8111-111111111111";
const availability = Object.fromEntries(
  DigitalAthleteSourcesSchema.shape.availability.keyof().options.map((key) => [key, true]),
);

function state() {
  return buildDigitalAthleteState(
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
}

function services() {
  return {
    snapshot: vi.fn().mockResolvedValue({
      state: state(),
      evaluatedAt: NOW.toISOString(),
      snapshot: { id: SNAPSHOT, schemaVersion: "1.0", computedAt: NOW.toISOString() },
    }),
    predictions: vi.fn().mockResolvedValue({
      checked: 0,
      evaluated: 0,
      independentDays: 0,
      pending: 0,
      limited: false,
    }),
    hypotheses: vi.fn().mockResolvedValue({ current: [], transitions: [] }),
    policyCanary: vi.fn().mockResolvedValue(
      buildTodayEngagementPolicyCanaryReview({
        checked: 0,
        evaluated: 0,
        pending: 0,
        limited: false,
      }),
    ),
    now: () => NOW,
  };
}

const input = {
  runKey: "2026-09-10",
  evidenceThrough: NOW.toISOString(),
  timeZone: "Europe/Vilnius",
};

describe("Night Review policy canary", () => {
  it("records shadow evidence without claiming treatment, causality or promotion", async () => {
    const report = await buildNightReview(input, services());
    expect(report.status).toBe("completed");
    expect(report.policyCanary).toEqual({
      status: "completed",
      result: {
        outcomeReview: { checked: 0, evaluated: 0, pending: 0, limited: false },
        readiness: {
          randomizedExposures: 0,
          causalEvidence: false,
          promotionEligible: false,
          state: "shadow_counterfactual_only",
        },
      },
    });
  });

  it("cannot call a night complete when canary evidence is unavailable", async () => {
    const deps = services();
    deps.policyCanary.mockRejectedValue(new Error("synthetic source failure"));
    const report = await buildNightReview(input, deps);
    expect(report.status).toBe("partial");
    expect(report.policyCanary).toEqual({ status: "unavailable" });
  });

  it("keeps a bounded policy backlog partial instead of hiding remaining work", async () => {
    const deps = services();
    deps.policyCanary.mockResolvedValue(
      buildTodayEngagementPolicyCanaryReview({
        checked: 64,
        evaluated: 64,
        pending: 0,
        limited: true,
      }),
    );
    const report = await buildNightReview(input, deps);
    expect(report.status).toBe("partial");
    expect(report.policyCanary).toMatchObject({
      status: "completed",
      result: { outcomeReview: { checked: 64, evaluated: 64, limited: true } },
    });
  });

  it("does not run policy review when the athlete snapshot is untrusted", async () => {
    const deps = services();
    deps.snapshot.mockResolvedValue({
      state: { ...state(), dataGaps: ["current_context_unavailable"] },
      snapshot: null,
    });
    const report = await buildNightReview(input, deps);
    expect(report.status).toBe("blocked");
    expect(report.policyCanary).toEqual({ status: "not_run" });
    expect(deps.policyCanary).not.toHaveBeenCalled();
  });

  it("rejects any receipt that upgrades shadow evidence into causal authority", async () => {
    const report = await buildNightReview(input, services());
    if (report.policyCanary?.status !== "completed") throw new Error("expected policy canary");
    expect(
      NightReviewSchema.safeParse({
        ...report,
        policyCanary: {
          ...report.policyCanary,
          result: {
            ...report.policyCanary.result,
            readiness: {
              randomizedExposures: 1,
              causalEvidence: true,
              promotionEligible: true,
              state: "shadow_counterfactual_only",
            },
          },
        },
      }).success,
    ).toBe(false);
  });
});