import { describe, expect, it } from "vitest";
import { decideRaceIntelligence } from "./endurance-race-intelligence.engine";

describe("decideRaceIntelligence", () => {
  it("collects evidence before making a confident training claim", () => {
    const result = decideRaceIntelligence({
      readiness: {
        status: "insufficient_evidence",
        factors: ["less_than_two_weeks_or_core_progress_missing"],
        evidenceLevel: "low",
      },
      adaptation: { action: "hold", volumeModifier: 1, reason: "insufficient_evidence" },
      nextSessionIntent: "easy",
      nextSessionDistanceMeters: 5000,
    });
    expect(result.action).toBe("collect_evidence");
    expect(result.confidence).toBe("low");
    expect(result.nextSession.volumeModifier).toBe(1);
  });

  it("prioritizes recovery when readiness is strained even if adaptation holds", () => {
    const result = decideRaceIntelligence({
      readiness: {
        status: "strained",
        factors: ["current_low_readiness", "low_session_completion"],
        evidenceLevel: "moderate",
      },
      adaptation: { action: "hold", volumeModifier: 1, reason: "on_track" },
      nextSessionIntent: "tempo",
      nextSessionDistanceMeters: 8000,
    });
    expect(result.action).toBe("recover");
    expect(result.nextSession.volumeModifier).toBe(0.8);
  });

  it("preserves a stricter deterministic recovery modifier", () => {
    const result = decideRaceIntelligence({
      readiness: {
        status: "strained",
        factors: ["repeated_low_training_response"],
        evidenceLevel: "high",
      },
      adaptation: {
        action: "recover",
        volumeModifier: 0.7,
        reason: "low_readiness_and_missed_work",
      },
      nextSessionIntent: "long",
      nextSessionDistanceMeters: 18000,
    });
    expect(result.action).toBe("recover");
    expect(result.nextSession.volumeModifier).toBe(0.7);
    expect(result.guardrails).toContain("ai_cannot_increase_deterministic_load");
  });

  it("proceeds when readiness and adaptation support the plan", () => {
    const result = decideRaceIntelligence({
      readiness: {
        status: "on_track",
        factors: ["consistent_plan_adherence"],
        evidenceLevel: "high",
      },
      adaptation: { action: "hold", volumeModifier: 1, reason: "on_track" },
      nextSessionIntent: "easy",
      nextSessionDistanceMeters: 6000,
    });
    expect(result.action).toBe("proceed");
    expect(result.confidence).toBe("high");
    expect(result.nextSession.volumeModifier).toBe(1);
  });
});
