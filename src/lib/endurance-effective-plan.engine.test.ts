import { describe, expect, it } from "vitest";
import {
  applyAdaptationToRemainingSessions,
  selectNextExecutableSession,
} from "./endurance-effective-plan.engine";
import type { EnduranceAdaptationDecision } from "./endurance-adaptation.engine";

const distanceSession = (
  intent: "easy" | "long" | "race",
  distance: number,
  key: string,
) => ({
  sessionKey: key,
  intent,
  plannedDurationMinutes: null,
  plannedDistanceMeters: distance,
  intensityCue: "x",
});

describe("effective endurance plan", () => {
  it("does not rewrite a completed session", () => {
    const result = applyAdaptationToRemainingSessions({
      sessions: [
        distanceSession("easy", 5_000, "w1-s1"),
        distanceSession("long", 12_000, "w1-s2"),
      ],
      completedSessionKeys: new Set(["w1-s1"]),
      adaptation: {
        action: "reduce",
        volumeModifier: 0.8,
        reason: "repeated_low_response",
      },
    });

    expect(result[0]?.plannedDistanceMeters).toBe(5_000);
    expect(result[1]?.plannedDistanceMeters).toBe(9_600);
    expect(result[1]?.originalDistanceMeters).toBe(12_000);
  });

  it("hold preserves original targets", () => {
    const result = applyAdaptationToRemainingSessions({
      sessions: [distanceSession("long", 10_000, "w1-s1")],
      completedSessionKeys: new Set(),
      adaptation: { action: "hold", volumeModifier: 1, reason: "on_track" },
    });

    expect(result[0]?.plannedDistanceMeters).toBe(10_000);
  });

  it("never changes the race distance itself", () => {
    const result = applyAdaptationToRemainingSessions({
      sessions: [distanceSession("race", 42_195, "w10-s1")],
      completedSessionKeys: new Set(),
      adaptation: {
        action: "recover",
        volumeModifier: 0.7,
        reason: "low_readiness_and_missed_work",
      },
    });

    expect(result[0]?.plannedDistanceMeters).toBe(42_195);
    expect(result[0]?.appliedVolumeModifier).toBe(1);
  });

  it("scales a future time-based session when distance is absent", () => {
    const result = applyAdaptationToRemainingSessions({
      sessions: [
        {
          sessionKey: "w1-s1",
          intent: "easy",
          plannedDurationMinutes: 50,
          plannedDistanceMeters: null,
          intensityCue: "Easy",
        },
      ],
      completedSessionKeys: new Set(),
      adaptation: {
        action: "reduce",
        volumeModifier: 0.8,
        reason: "repeated_low_response",
      },
    });

    expect(result[0]?.plannedDurationMinutes).toBe(40);
    expect(result[0]?.originalDurationMinutes).toBe(50);
  });

  it("suppresses the next planned run while recovery is governing", () => {
    const adaptation: EnduranceAdaptationDecision = {
      action: "recover",
      volumeModifier: 0.7,
      reason: "low_readiness_and_missed_work",
    };
    const effective = applyAdaptationToRemainingSessions({
      sessions: [distanceSession("easy", 5_000, "w1-s1")],
      completedSessionKeys: new Set(),
      adaptation,
    });

    expect(
      selectNextExecutableSession({
        sessions: effective,
        completedSessionKeys: new Set(),
        adaptation,
      }),
    ).toBeNull();
  });
});
