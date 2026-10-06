import type { EndurancePlanSession } from "./endurance-race-goal.schema";
import type { CompletedRunEvidence } from "./endurance-race-progress.engine";

export type RaceSessionMatch =
  | {
      status: "no_match";
      plannedIndex: null;
      score: 0;
      reason: "no_planned_sessions" | "insufficient_evidence";
    }
  | {
      status: "needs_confirmation";
      plannedIndex: number;
      plannedSessionKey: string;
      score: number;
      reason: "distance_only" | "ambiguous_candidates";
    }
  | {
      status: "confident";
      plannedIndex: number;
      plannedSessionKey: string;
      score: number;
      reason: "distance_and_effort_align";
    };

const round2 = (v: number) => Math.round(v * 100) / 100;

function expectedRpe(intent: EndurancePlanSession["intent"]): [number, number] {
  switch (intent) {
    case "recovery":
      return [1, 3];
    case "easy":
      return [2, 5];
    case "long":
      return [3, 6];
    case "tempo":
      return [6, 8];
    case "intervals":
      return [7, 10];
    case "race":
      return [7, 10];
  }
}

export function matchCompletedRunToPlan(
  planned: readonly EndurancePlanSession[],
  completed: CompletedRunEvidence,
): RaceSessionMatch {
  if (planned.length === 0)
    return { status: "no_match", plannedIndex: null, score: 0, reason: "no_planned_sessions" };
  if (completed.distanceMeters === null || completed.distanceMeters <= 0)
    return { status: "no_match", plannedIndex: null, score: 0, reason: "insufficient_evidence" };

  const candidates = planned
    .flatMap((session, index) => {
      if (session.plannedDistanceMeters === null) return [];
      const distanceRatio = completed.distanceMeters! / session.plannedDistanceMeters;
      const distanceScore = Math.max(0, 1 - Math.abs(1 - distanceRatio));
      const [low, high] = expectedRpe(session.intent);
      const effortKnown = completed.perceivedEffort !== null;
      const effortScore = !effortKnown
        ? null
        : completed.perceivedEffort! >= low && completed.perceivedEffort! <= high
          ? 1
          : 0;
      const score = round2(
        effortScore === null ? distanceScore * 0.75 : distanceScore * 0.7 + effortScore * 0.3,
      );
      if (!session.sessionKey) return [];
      return [
        {
          index,
          sessionKey: session.sessionKey,
          score,
          effortKnown,
          effortAligned: effortScore === 1,
        },
      ];
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 0.55)
    return { status: "no_match", plannedIndex: null, score: 0, reason: "insufficient_evidence" };
  const second = candidates[1];
  const ambiguous = second !== undefined && best.score - second.score < 0.08;
  if (best.effortKnown && best.effortAligned && best.score >= 0.85 && !ambiguous) {
    return {
      status: "confident",
      plannedIndex: best.index,
      plannedSessionKey: best.sessionKey,
      score: best.score,
      reason: "distance_and_effort_align",
    };
  }
  return {
    status: "needs_confirmation",
    plannedIndex: best.index,
    plannedSessionKey: best.sessionKey,
    score: best.score,
    reason: ambiguous ? "ambiguous_candidates" : "distance_only",
  };
}
