export type EnduranceAdaptationSignal = {
  completedPlannedSessions: number;
  plannedSessions: number;
  lowResponseStreak: number;
  readinessBand: "low" | "moderate" | "high" | "unknown";
};

export type EnduranceAdaptationDecision =
  | { action: "hold"; volumeModifier: 1; reason: "insufficient_evidence" | "on_track" }
  | { action: "reduce"; volumeModifier: 0.8; reason: "repeated_low_response" }
  | { action: "recover"; volumeModifier: 0.7; reason: "low_readiness_and_missed_work" };

/**
 * Conservative first adaptation policy. It reacts to repeated evidence, not a
 * single difficult run. AI may explain this decision but cannot silently
 * override it.
 */
export function decideEnduranceAdaptation(
  signal: EnduranceAdaptationSignal,
): EnduranceAdaptationDecision {
  if (signal.plannedSessions < 2) {
    return { action: "hold", volumeModifier: 1, reason: "insufficient_evidence" };
  }

  const completionRate =
    signal.plannedSessions > 0
      ? signal.completedPlannedSessions / signal.plannedSessions
      : 0;

  if (signal.readinessBand === "low" && completionRate < 0.5) {
    return { action: "recover", volumeModifier: 0.7, reason: "low_readiness_and_missed_work" };
  }

  if (signal.lowResponseStreak >= 3) {
    return { action: "reduce", volumeModifier: 0.8, reason: "repeated_low_response" };
  }

  return { action: "hold", volumeModifier: 1, reason: "on_track" };
}
