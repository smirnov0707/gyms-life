import { MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION } from "./prediction-calibration.schema";
import { PredictionTargetSchema, type PredictionTarget } from "./prediction.schema";

/**
 * How much a prediction target has actually been tested, on the scale the
 * constitution asks for: insufficient, early, moderate, strong.
 *
 * This is the replacement for a single blended confidence percentage. A
 * number like "82%" across four targets reads as a calibrated probability
 * and is not one — it is an average of things measured to different degrees,
 * some of them not measured at all. A level plus the count behind it says
 * the same thing without the false precision, and cannot be mistaken for a
 * probability.
 *
 * Only *resolved* predictions count. One that has been made and not yet had
 * its outcome observed is evidence of nothing: it is the claim, not the test.
 *
 * Pure and total.
 */

export type EvidenceLevel = "insufficient" | "early" | "moderate" | "strong";

/**
 * Where each level begins, as multiples of the calibration minimum.
 *
 * Deliberate and user-visible, like the fatigue decay constant: these
 * thresholds decide what the athlete is told about how much the system knows,
 * so they are a stated choice rather than a tuning detail. At the current
 * minimum of 8 that is: under 8 insufficient, 8-15 early, 16-31 moderate,
 * 32 and above strong.
 */
export const EVIDENCE_LEVEL_MULTIPLES = { early: 1, moderate: 2, strong: 4 } as const;

export function evidenceLevelFor(
  evaluated: number,
  minimum: number = MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION,
): EvidenceLevel {
  if (!Number.isFinite(evaluated) || evaluated < minimum * EVIDENCE_LEVEL_MULTIPLES.early) {
    return "insufficient";
  }
  if (evaluated >= minimum * EVIDENCE_LEVEL_MULTIPLES.strong) return "strong";
  if (evaluated >= minimum * EVIDENCE_LEVEL_MULTIPLES.moderate) return "moderate";
  return "early";
}

export type TargetEvidence = {
  target: PredictionTarget;
  /**
   * False when no model has ever produced a prediction for this target.
   *
   * Kept apart from `insufficient`, which means predictions exist and too few
   * have resolved. "We have never tried to predict this" and "we have tried
   * and cannot say yet" are different admissions, and only one of them is
   * about the athlete's data.
   */
  modelled: boolean;
  level: EvidenceLevel;
  /** Predictions made. */
  captured: number;
  /** Predictions whose outcome has been observed. Only these count. */
  evaluated: number;
  /** Made, not yet resolved. */
  pending: number;
  minimumEvaluated: number;
};

export type EvidenceReport =
  /** The ledger could not be read. Not the same as never having predicted. */
  { status: "unreadable" } | { status: "counted"; targets: TargetEvidence[] };

/**
 * Every target the system defines, whether or not anything has been predicted
 * for it — a panel that listed only the modelled ones would quietly imply the
 * others are covered.
 */
export function buildEvidenceReport(input: {
  /** Null when the read failed rather than returned nothing. */
  counts:
    | readonly { target: PredictionTarget; captured: number; evaluated: number; pending: number }[]
    | null;
  minimumEvaluated?: number;
}): EvidenceReport {
  if (input.counts === null) return { status: "unreadable" };
  const minimum = input.minimumEvaluated ?? MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION;

  return {
    status: "counted",
    targets: PredictionTargetSchema.options.map((target) => {
      const found = input.counts?.find((entry) => entry.target === target);
      return {
        target,
        modelled: found !== undefined && found.captured > 0,
        level: evidenceLevelFor(found?.evaluated ?? 0, minimum),
        captured: found?.captured ?? 0,
        evaluated: found?.evaluated ?? 0,
        pending: found?.pending ?? 0,
        minimumEvaluated: minimum,
      };
    }),
  };
}
