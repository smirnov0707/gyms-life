import type { CoachContext, CoachRecommendation } from "./ai-coach.contract";

export type GovernedCoachRecommendation = {
  recommendation: CoachRecommendation;
  enduranceExecution: "allowed" | "blocked";
  violations: string[];
};

export function governCoachRecommendation(
  context: CoachContext,
  recommendation: CoachRecommendation,
): GovernedCoachRecommendation {
  const violations: string[] = [];
  const endurance = context.endurance;

  if (!endurance.active) {
    return { recommendation, enduranceExecution: "allowed", violations };
  }

  for (const action of recommendation.actions) {
    const genericOrEnduranceAction = action.exerciseSlug === null;

    if (genericOrEnduranceAction && action.type === "INCREASE_LOAD") {
      violations.push("endurance_load_increase_requires_deterministic_plan");
    }

    if (
      genericOrEnduranceAction &&
      action.type === "DECREASE_LOAD" &&
      action.unit === "percent" &&
      action.value !== null &&
      action.value < 0
    ) {
      violations.push("invalid_negative_load_reduction");
    }

    if (
      endurance.adaptation?.action === "recover" &&
      genericOrEnduranceAction &&
      (action.type === "INCREASE_LOAD" || action.type === "KEEP_PLAN")
    ) {
      violations.push("deterministic_recovery_guard_conflict");
    }

    if (
      endurance.adaptation?.action === "reduce" &&
      genericOrEnduranceAction &&
      action.type === "INCREASE_LOAD"
    ) {
      violations.push("deterministic_reduction_guard_conflict");
    }
  }

  const text = [
    recommendation.summary,
    ...recommendation.rationale,
    ...recommendation.actions.map((action) => action.instruction),
  ]
    .join(" ")
    .toLowerCase();

  const banned = [
    ["vo2max", "vo2max_without_measurement"],
    ["guarantee", "guaranteed_race_time"],
    ["diagnos", "diagnosis"],
  ] as const;

  for (const [needle, code] of banned) {
    if (text.includes(needle) && endurance.prohibitedClaims.includes(code)) {
      violations.push(code);
    }
  }

  if (
    endurance.postRun?.nextAction === "protect_recovery" &&
    recommendation.actions.some(
      (action) =>
        action.exerciseSlug === null &&
        (action.type === "INCREASE_LOAD" || action.type === "KEEP_PLAN"),
    )
  ) {
    violations.push("post_run_recovery_guard_conflict");
  }

  return {
    recommendation,
    enduranceExecution: violations.length > 0 ? "blocked" : "allowed",
    violations: [...new Set(violations)],
  };
}
