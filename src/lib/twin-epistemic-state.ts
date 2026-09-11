import { z } from "zod";
import type { DeterministicPerformanceForecast } from "./forecast.schema";
import type { LabOverview } from "./lab.schema";

export const TwinEpistemicPredictionStateSchema = z.enum([
  "unavailable",
  "learning",
  "shadow_uncalibrated",
  "shadow_metrics_available",
]);

export const TwinEpistemicStateSchema = z
  .object({
    observed: z.object({
      answeredDecisions: z.number().int().nonnegative(),
      evaluatedPredictionOutcomes: z.number().int().nonnegative(),
    }),
    hypotheses: z.object({
      supported: z.number().int().nonnegative(),
      monitoring: z.number().int().nonnegative(),
      insufficientEvidence: z.number().int().nonnegative(),
      contradicted: z.number().int().nonnegative(),
    }),
    prediction: z.object({
      state: TwinEpistemicPredictionStateSchema,
      calibratedModelCount: z.number().int().nonnegative(),
      forecastLiftCount: z.number().int().nonnegative(),
      forecastEvidence: z.object({
        low: z.number().int().nonnegative(),
        moderate: z.number().int().nonnegative(),
        high: z.number().int().nonnegative(),
      }),
    }),
    unknowns: z.object({
      dataGapCount: z.number().int().nonnegative(),
      unreadableSourceCount: z.number().int().nonnegative(),
    }),
    guardrails: z.object({
      shadowPredictionInfluencesToday: z.literal(false),
      futureMeForecastInfluencesToday: z.literal(false),
      unsupportedHypothesisInfluencesToday: z.literal(false),
    }),
  })
  .strict();

export type TwinEpistemicState = z.infer<typeof TwinEpistemicStateSchema>;
function predictionState(lab: LabOverview | null): TwinEpistemicState["prediction"]["state"] {
  if (!lab) return "unavailable";
  if (lab.predictionCalibration.totalCaptured === 0) return "learning";
  const calibrated = lab.predictionCalibration.models.some(
    (model) => model.brierScore !== null && model.calibrationGap !== null,
  );
  return calibrated ? "shadow_metrics_available" : "shadow_uncalibrated";
}

export function buildTwinEpistemicState(
  lab: LabOverview | null,
  forecast: DeterministicPerformanceForecast | null,
): TwinEpistemicState {
  const hypotheses = lab?.hypotheses ?? [];
  const lifts = forecast?.status === "ready" ? forecast.lifts : [];
  const evidence = { low: 0, moderate: 0, high: 0 };
  for (const lift of lifts) evidence[lift.evidenceStrength] += 1;

  return TwinEpistemicStateSchema.parse({
    observed: {
      answeredDecisions: lab?.decisionAccuracy.totalAnswered ?? 0,
      evaluatedPredictionOutcomes: lab?.predictionCalibration.totalEvaluated ?? 0,
    },
    hypotheses: {
      supported: hypotheses.filter((item) => item.status === "supported").length,
      monitoring: hypotheses.filter((item) => item.status === "monitoring").length,
      insufficientEvidence: hypotheses.filter((item) => item.status === "insufficient_evidence")
        .length,
      contradicted: hypotheses.filter((item) => item.status === "contradicted").length,
    },
    prediction: {
      state: predictionState(lab),
      calibratedModelCount:
        lab?.predictionCalibration.models.filter((model) => model.brierScore !== null).length ?? 0,
      forecastLiftCount: lifts.length,
      forecastEvidence: evidence,
    },
    unknowns: {
      dataGapCount: lab?.dataGaps.length ?? 0,
      unreadableSourceCount: lab?.unreadable.length ?? 0,
    },
    guardrails: {
      shadowPredictionInfluencesToday: false,
      futureMeForecastInfluencesToday: false,
      unsupportedHypothesisInfluencesToday: false,
    },
  });
}
