export type RaceReadinessInput = {
  weeksObserved: number;
  sessionCompletionRate: number | null;
  distanceCompletionRate: number | null;
  longestRunProgressRate: number | null;
  recentLowResponseStreak: number;
  latestReadinessBand: "low" | "moderate" | "high" | "unknown";
  repeatedOverTargetRuns: number;
};

export type RaceReadiness =
  | { status: "insufficient_evidence"; factors: string[]; evidenceLevel: "low" }
  | { status: "building" | "on_track" | "strained"; factors: string[]; evidenceLevel: "moderate" | "high" };

export function assessRaceReadiness(input: RaceReadinessInput): RaceReadiness {
  const factors: string[] = [];
  const measured = [input.sessionCompletionRate, input.distanceCompletionRate, input.longestRunProgressRate].filter((v) => v !== null).length;
  if (input.weeksObserved < 2 || measured < 2) {
    return { status: "insufficient_evidence", factors: ["less_than_two_weeks_or_core_progress_missing"], evidenceLevel: "low" };
  }

  if (input.recentLowResponseStreak >= 3) factors.push("repeated_low_training_response");
  if (input.latestReadinessBand === "low") factors.push("current_low_readiness");
  if (input.repeatedOverTargetRuns >= 2) factors.push("repeated_over_target_work");
  if ((input.sessionCompletionRate ?? 1) < 0.6) factors.push("low_session_completion");
  if ((input.distanceCompletionRate ?? 1) < 0.65) factors.push("low_distance_completion");

  if (factors.length >= 2 || input.recentLowResponseStreak >= 3) {
    return { status: "strained", factors, evidenceLevel: input.weeksObserved >= 4 ? "high" : "moderate" };
  }

  const adherenceGood = (input.sessionCompletionRate ?? 0) >= 0.75 && (input.distanceCompletionRate ?? 0) >= 0.75;
  const longRunGood = input.longestRunProgressRate === null || input.longestRunProgressRate >= 0.7;
  if (adherenceGood && longRunGood && input.latestReadinessBand !== "low") {
    return { status: "on_track", factors: ["consistent_plan_adherence"], evidenceLevel: input.weeksObserved >= 4 ? "high" : "moderate" };
  }

  return { status: "building", factors: ["preparation_still_developing"], evidenceLevel: input.weeksObserved >= 4 ? "high" : "moderate" };
}
