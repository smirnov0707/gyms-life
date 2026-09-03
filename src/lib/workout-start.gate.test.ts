import { describe, expect, it } from "vitest";
import { evaluateWorkoutStartGate } from "./workout-start.gate";

describe("evaluateWorkoutStartGate", () => {
  const ready = { status: "ready", nextWorkoutDay: 2 } as const;

  it("requires the current sequence and same-day readiness for a new session", () => {
    expect(
      evaluateWorkoutStartGate({
        availability: ready,
        requestedDay: 2,
        hasOpenSession: false,
        hasTodayReadiness: false,
      }),
    ).toEqual({ allowed: false, reason: "readiness_required" });

    expect(
      evaluateWorkoutStartGate({
        availability: ready,
        requestedDay: 1,
        hasOpenSession: false,
        hasTodayReadiness: true,
      }),
    ).toEqual({ allowed: false, reason: "not_next_workout" });
  });

  it("allows a ready next workout and a persisted session to resume", () => {
    expect(
      evaluateWorkoutStartGate({
        availability: ready,
        requestedDay: 2,
        hasOpenSession: false,
        hasTodayReadiness: true,
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateWorkoutStartGate({
        availability: ready,
        requestedDay: 2,
        hasOpenSession: true,
        hasTodayReadiness: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("does not allow a new session when today's canonical workout is unavailable", () => {
    expect(
      evaluateWorkoutStartGate({
        availability: { status: "unavailable" },
        requestedDay: 2,
        hasOpenSession: false,
        hasTodayReadiness: true,
      }),
    ).toEqual({ allowed: false, reason: "workout_unavailable" });
  });
});
