import { z } from "zod";

export const ExperimentEffectDirectionSchema = z.enum(["higher", "lower", "flat", "unknown"]);

export const ExperimentRetrospectiveSchema = z.object({
  baselineCount: z.number().int().nonnegative(),
  interventionCount: z.number().int().nonnegative(),
  followupCount: z.number().int().nonnegative(),
  baselineMean: z.number().finite().nullable(),
  interventionMean: z.number().finite().nullable(),
  followupMean: z.number().finite().nullable(),
  absoluteDelta: z.number().finite().nullable(),
  relativeDeltaPct: z.number().finite().nullable(),
  direction: ExperimentEffectDirectionSchema,
  evidence: z.enum(["insufficient", "uncertain", "association_observed"]),
  causalClaimAllowed: z.literal(false),
  decisionAuthority: z.literal(false),
});

export type ExperimentRetrospective = z.infer<typeof ExperimentRetrospectiveSchema>;
type NumericOutcome = {
  phase: string;
  outcome_key: string;
  numeric_value: number | null;
};

const mean = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

export function buildPersonalExperimentRetrospective(input: {
  primaryOutcome: string;
  outcomes: NumericOutcome[];
}): ExperimentRetrospective {
  const relevant = input.outcomes.filter(
    (item) =>
      item.outcome_key === input.primaryOutcome &&
      item.numeric_value !== null &&
      (item.phase === "baseline" || item.phase === "intervention" || item.phase === "followup"),
  );
  const baseline = relevant
    .filter((item) => item.phase === "baseline")
    .map((item) => item.numeric_value!);
  const intervention = relevant
    .filter((item) => item.phase === "intervention")
    .map((item) => item.numeric_value!);
  const followup = relevant
    .filter((item) => item.phase === "followup")
    .map((item) => item.numeric_value!);
  const baselineMean = mean(baseline);
  const interventionMean = mean(intervention);
  const followupMean = mean(followup);
  const enough = baseline.length >= 3 && intervention.length >= 3;
  const absoluteDelta =
    enough && baselineMean !== null && interventionMean !== null
      ? interventionMean - baselineMean
      : null;
  const relativeDeltaPct =
    absoluteDelta !== null && baselineMean !== null && baselineMean !== 0
      ? (absoluteDelta / Math.abs(baselineMean)) * 100
      : null;
  const tolerance = baselineMean === null ? null : Math.max(Math.abs(baselineMean) * 0.01, 1e-9);
  const direction =
    absoluteDelta === null || tolerance === null
      ? "unknown"
      : Math.abs(absoluteDelta) <= tolerance
        ? "flat"
        : absoluteDelta > 0
          ? "higher"
          : "lower";
  const evidence = !enough
    ? "insufficient"
    : direction === "flat" || direction === "unknown"
      ? "uncertain"
      : "association_observed";

  return ExperimentRetrospectiveSchema.parse({
    baselineCount: baseline.length,
    interventionCount: intervention.length,
    followupCount: followup.length,
    baselineMean,
    interventionMean,
    followupMean,
    absoluteDelta,
    relativeDeltaPct,
    direction,
    evidence,
    causalClaimAllowed: false,
    decisionAuthority: false,
  });
}
