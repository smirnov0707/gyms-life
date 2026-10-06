import type { EndurancePlanSession } from "./endurance-race-goal.schema";
import type { EnduranceAdaptationDecision } from "./endurance-adaptation.engine";

export type EffectiveEnduranceSession = EndurancePlanSession & {
  originalDistanceMeters: number | null;
  originalDurationMinutes: number | null;
  appliedVolumeModifier: number;
};

const roundDistance = (value: number) => Math.max(500, Math.round(value / 100) * 100);
const roundMinutes = (value: number) => Math.max(5, Math.round(value));

export function applyAdaptationToRemainingSessions(input: {
  sessions: readonly EndurancePlanSession[];
  completedSessionKeys: ReadonlySet<string>;
  adaptation: EnduranceAdaptationDecision;
}): EffectiveEnduranceSession[] {
  return input.sessions.map((session) => {
    const completed = input.completedSessionKeys.has(session.sessionKey);
    // Race distance is an event definition, not training volume. A recovery
    // decision changes the lead-in recommendation, never the race distance.
    const canAdapt = !completed && session.intent !== "race";
    const modifier = canAdapt ? input.adaptation.volumeModifier : 1;
    const originalDistance = session.plannedDistanceMeters;
    const originalDuration = session.plannedDurationMinutes;

    return {
      ...session,
      originalDistanceMeters: originalDistance,
      originalDurationMinutes: originalDuration,
      appliedVolumeModifier: modifier,
      plannedDistanceMeters:
        originalDistance === null
          ? null
          : canAdapt
            ? roundDistance(originalDistance * modifier)
            : originalDistance,
      plannedDurationMinutes:
        originalDuration === null
          ? null
          : canAdapt
            ? roundMinutes(originalDuration * modifier)
            : originalDuration,
    };
  });
}
