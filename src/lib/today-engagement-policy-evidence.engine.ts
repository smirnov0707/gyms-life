import {
  TodayEngagementPolicyEvidenceSchema,
  type TodayEngagementPolicyEvidence,
} from "./today-engagement-policy-evidence.schema";

export function summarizeTodayEngagementPolicyEvidence(
  rows: Array<{
    comparison: "equivalent_shadow" | "counterfactual_unobserved";
    observedCompletion: boolean;
  }>,
): TodayEngagementPolicyEvidence {
  const arm = (comparison: "equivalent_shadow" | "counterfactual_unobserved") => {
    const selected = rows.filter((row) => row.comparison === comparison);
    const completedDays = selected.filter((row) => row.observedCompletion).length;
    return {
      reviewedDays: selected.length,
      completedDays,
      completionRate: selected.length ? completedDays / selected.length : null,
    };
  };
  const equivalent = arm("equivalent_shadow");
  const counterfactual = arm("counterfactual_unobserved");
  const observationalDelta =
    equivalent.completionRate === null || counterfactual.completionRate === null
      ? null
      : counterfactual.completionRate - equivalent.completionRate;
  return TodayEngagementPolicyEvidenceSchema.parse({
    equivalent,
    counterfactual,
    observationalDelta,
    causalEvidence: false,
    promotionEligible: false,
  });
}
