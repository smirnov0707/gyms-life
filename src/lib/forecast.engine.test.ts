import { describe, expect, it } from "vitest";
import {
  buildDeterministicPerformanceForecast,
  FORECAST_MINIMUM_SESSION_COUNT,
  FORECAST_MINIMUM_SPAN_DAYS,
} from "./forecast.engine";
import { WorkoutSetLogSchema, type WorkoutSetLog } from "./workout-set-log.schema";

const NOW = new Date("2026-03-01T12:00:00.000Z");

function set(index: number, overrides: Partial<WorkoutSetLog> = {}): WorkoutSetLog {
  const createdAt = new Date("2026-01-01T10:00:00.000Z");
  createdAt.setUTCDate(createdAt.getUTCDate() + index * 7);
  return WorkoutSetLogSchema.parse({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sessionId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    exerciseSlug: "barbell-squat",
    exerciseName: "Barbell Squat",
    setNumber: 1,
    reps: 5,
    weightKg: 100,
    rpe: 8,
    done: true,
    createdAt: createdAt.toISOString(),
    performedAt: createdAt.toISOString(),
    ...overrides,
  });
}

describe("deterministic performance forecast", () => {
  it("reads the trend from when sets were performed, not when they synced", () => {
    // A forecast is a line through time. `createdAt` moves when a session
    // syncs late, so a set performed weeks ago can carry today's write time
    // and drag the trend with it. Here every set keeps its real performance
    // date while its row claims to have been written at one instant — the
    // forecast must follow the former.
    const performedOverWeeks = Array.from({ length: 12 }, (_, index) =>
      set(index, { createdAt: NOW.toISOString() }),
    );
    const honest = buildDeterministicPerformanceForecast(performedOverWeeks, NOW);

    // Same rows, but now the engine is told they all happened at once.
    const bunched = performedOverWeeks.map((row) => ({
      ...row,
      performedAt: NOW.toISOString(),
    }));
    const collapsed = buildDeterministicPerformanceForecast(bunched, NOW);

    expect(honest.status).not.toBe(collapsed.status);
  });

  it("waits for enough distinct sessions and time before forecasting", () => {
    const result = buildDeterministicPerformanceForecast([set(0), set(1), set(2)], NOW);

    expect(result).toMatchObject({
      status: "learning",
      minimumSessionCount: FORECAST_MINIMUM_SESSION_COUNT,
      minimumSpanDays: FORECAST_MINIMUM_SPAN_DAYS,
    });
  });

  it("uses one best estimated 1RM per session rather than set count", () => {
    const repeatedSession = set(4, {
      id: "00000000-0000-4000-8000-000000000099",
      sessionId: "10000000-0000-4000-8000-000000000003",
      setNumber: 2,
      weightKg: 102.5,
    });
    const result = buildDeterministicPerformanceForecast(
      [set(0), set(1), set(2), set(3), repeatedSession],
      NOW,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lifts[0]?.evidence.sessionCount).toBe(4);
    expect(result.lifts[0]?.currentEstimated1RMKg).toBe(119.6);
  });

  it("returns conservative rising estimates with explicit low confidence for short history", () => {
    const result = buildDeterministicPerformanceForecast(
      [set(0), set(1, { weightKg: 102.5 }), set(2, { weightKg: 105 }), set(3, { weightKg: 107.5 })],
      NOW,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const lift = result.lifts[0];
    expect(lift).toMatchObject({ trend: "rising", evidenceStrength: "low" });
    expect(lift?.projected4WeeksEstimated1RMKg).toBeLessThanOrEqual(
      (lift?.currentEstimated1RMKg ?? 0) * 1.06,
    );
    expect(lift?.projected12WeeksEstimated1RMKg).toBeLessThanOrEqual(
      (lift?.currentEstimated1RMKg ?? 0) * 1.13,
    );
    expect("nextWorkingWeight" in (lift ?? {})).toBe(false);
  });

  it("keeps exercises isolated and does not let a declining trend prescribe a load", () => {
    const squat = [
      set(0, { weightKg: 112.5 }),
      set(1, { weightKg: 110 }),
      set(2, { weightKg: 107.5 }),
      set(3, { weightKg: 105 }),
    ];
    const singleBenchSet = set(20, {
      exerciseSlug: "barbell-bench-press",
      exerciseName: "Barbell Bench Press",
      weightKg: 80,
      createdAt: "2026-02-14T10:00:00.000Z",
      performedAt: "2026-02-14T10:00:00.000Z",
    });
    const result = buildDeterministicPerformanceForecast([...squat, singleBenchSet], NOW);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lifts).toHaveLength(1);
    expect(result.lifts[0]).toMatchObject({
      exerciseSlug: "barbell-squat",
      trend: "falling",
    });
    expect(result.lifts[0]?.projected4WeeksEstimated1RMKg).toBeLessThanOrEqual(
      result.lifts[0]?.currentEstimated1RMKg ?? 0,
    );
  });

  it("excludes future, incomplete, and high-repetition sets from the source evidence", () => {
    const result = buildDeterministicPerformanceForecast(
      [
        set(0),
        set(1),
        set(2),
        set(3),
        set(50, { done: false }),
        set(51, { reps: 40 }),
        set(52, { createdAt: "2026-04-01T10:00:00.000Z" }),
      ],
      NOW,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.lifts[0]?.evidence.sessionCount).toBe(4);
  });
});
