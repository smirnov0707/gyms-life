import type { EvidenceLevel } from "@/lib/evidence-level.engine";

/**
 * The four-step shape beside each prediction target, and what each step means.
 *
 * The panel exists because a blended "82% confidence" reads as a calibrated
 * probability and is not one. Four steps filled to the level reached say the
 * same thing without the false precision.
 *
 * But the engine keeps a distinction the shape was throwing away. A target
 * nothing has ever predicted is `modelled: false`, and its own comment says
 * why it is not folded into `insufficient`: "We have never tried to predict
 * this" and "we have tried and cannot say yet" are different admissions, and
 * only one of them is about the athlete's data. The level for an unmodelled
 * target is `insufficient` for the arithmetic's sake — `evidenceLevelFor(0)` —
 * and the shape was drawn from that level alone, so a target with no model
 * behind it at all and a target with seven resolved predictions produced the
 * identical mark. The text column told them apart; the shape did not.
 *
 * A level is a position on a scale. A target nothing has predicted is not at
 * the bottom of that scale — it is not on it. So it gets an empty track: four
 * steps, none of them standing for anything reached.
 *
 * Pure and total.
 */

/**
 * `reached` — a level this target is past.
 * `current` — the level it is at.
 * `empty`   — not reached, or, for a target nothing has predicted, not on the
 *             scale at all.
 */
export type StepFill = "reached" | "current" | "empty";

/** Where each level sits on the track. */
const LEVEL_STEP: Record<EvidenceLevel, number> = {
  insufficient: 0,
  early: 1,
  moderate: 2,
  strong: 3,
};

export const EVIDENCE_STEP_COUNT = 4;

export function evidenceSteps(entry: {
  readonly modelled: boolean;
  readonly level: EvidenceLevel;
}): readonly StepFill[] {
  const steps = Array.from({ length: EVIDENCE_STEP_COUNT }, (_, step) => step);
  if (!entry.modelled) return steps.map(() => "empty" as const);
  const at = LEVEL_STEP[entry.level];
  return steps.map((step) => (step < at ? "reached" : step === at ? "current" : "empty"));
}
