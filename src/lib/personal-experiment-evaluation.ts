import { z } from "zod";

export const PersonalExperimentEvaluationSchema = z
  .object({
    baselineObservations: z.number().int().nonnegative(),
    interventionObservations: z.number().int().nonnegative(),
    repeatedCycleCount: z.number().int().nonnegative(),
    directionallyConsistent: z.boolean(),
    result: z.enum(["insufficient", "no_clear_signal", "association_observed"]),
    causalClaimAllowed: z.literal(false),
    decisionAuthority: z.literal(false),
    requiresReplication: z.boolean(),
  })
  .strict();

export type PersonalExperimentEvaluation = z.infer<typeof PersonalExperimentEvaluationSchema>;

export function evaluatePersonalExperiment(input: {
  baselineObservations: number;
  interventionObservations: number;
  repeatedCycleCount: number;
  directionallyConsistent: boolean;
}): PersonalExperimentEvaluation {
  const enoughObservations = input.baselineObservations >= 3 && input.interventionObservations >= 3;
  const repeated = input.repeatedCycleCount >= 2;
  const result = !enoughObservations
    ? "insufficient"
    : input.directionallyConsistent && repeated
      ? "association_observed"
      : "no_clear_signal";

  return PersonalExperimentEvaluationSchema.parse({
    ...input,
    result,
    causalClaimAllowed: false,
    decisionAuthority: false,
    requiresReplication: result !== "insufficient",
  });
}
