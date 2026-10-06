import type { EnduranceAdaptationDecision } from "./endurance-adaptation.engine";
import type { RaceReadiness } from "./endurance-race-readiness.engine";
import type { AdaptationLesson } from "./endurance-adaptation-memory.engine";

export type RaceIntelligenceInput = {
  readiness: RaceReadiness;
  adaptation: EnduranceAdaptationDecision;
  nextSessionIntent: string | null;
  nextSessionDistanceMeters: number | null;
  adaptationLesson?: AdaptationLesson | null;
};

export type RaceIntelligenceDecision = {
  action: "collect_evidence" | "recover" | "reduce" | "proceed";
  confidence: "low" | "moderate" | "high";
  nextSession: {
    intent: string | null;
    plannedDistanceMeters: number | null;
    volumeModifier: number;
  };
  reasons: string[];
  guardrails: string[];
};

/**
 * Canonical deterministic decision boundary for Race Prep.
 * Downstream AI may translate/explain this result, but may not increase load
 * or replace the action without a new deterministic evaluation.
 */
export function decideRaceIntelligence(input: RaceIntelligenceInput): RaceIntelligenceDecision {
  const guardrails = [
    "no_diagnosis",
    "no_guaranteed_race_outcome",
    "ai_cannot_increase_deterministic_load",
  ];

  if (input.readiness.status === "insufficient_evidence") {
    return {
      action: "collect_evidence",
      confidence: "low",
      nextSession: {
        intent: input.nextSessionIntent,
        plannedDistanceMeters: input.nextSessionDistanceMeters,
        volumeModifier: Math.min(1, input.adaptation.volumeModifier),
      },
      reasons: [...input.readiness.factors, input.adaptation.reason],
      guardrails,
    };
  }

  const confidence = input.readiness.evidenceLevel;
  const cautionApplies =
    input.adaptationLesson?.status === "caution" &&
    input.adaptationLesson.reason === input.adaptation.reason;

  if (input.adaptation.action === "recover" || input.readiness.status === "strained") {
    const modifier =
      input.adaptation.action === "recover"
        ? input.adaptation.volumeModifier
        : Math.min(0.8, input.adaptation.volumeModifier);
    return {
      action: "recover",
      confidence,
      nextSession: {
        intent: input.nextSessionIntent,
        plannedDistanceMeters: input.nextSessionDistanceMeters,
        volumeModifier: modifier,
      },
      reasons: [...input.readiness.factors, input.adaptation.reason],
      guardrails,
    };
  }

  if (cautionApplies && input.adaptation.action === "hold") {
    return {
      action: "reduce",
      confidence,
      nextSession: {
        intent: input.nextSessionIntent,
        plannedDistanceMeters: input.nextSessionDistanceMeters,
        volumeModifier: 0.9,
      },
      reasons: [...input.readiness.factors, input.adaptation.reason, "personal_adaptation_caution"],
      guardrails,
    };
  }

  if (input.adaptation.action === "reduce") {
    return {
      action: "reduce",
      confidence,
      nextSession: {
        intent: input.nextSessionIntent,
        plannedDistanceMeters: input.nextSessionDistanceMeters,
        volumeModifier: input.adaptation.volumeModifier,
      },
      reasons: [...input.readiness.factors, input.adaptation.reason],
      guardrails,
    };
  }

  return {
    action: "proceed",
    confidence,
    nextSession: {
      intent: input.nextSessionIntent,
      plannedDistanceMeters: input.nextSessionDistanceMeters,
      volumeModifier: 1,
    },
    reasons: [...input.readiness.factors, input.adaptation.reason],
    guardrails,
  };
}
