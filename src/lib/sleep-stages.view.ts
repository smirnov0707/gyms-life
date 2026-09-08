import { SLEEP_STAGE_ORDER, type SleepStage, type SleepStageSlice } from "./sleep-stages.engine";

/**
 * How wide each stage's bar is drawn, and what that width is a fraction of.
 *
 * The engine already refuses to state a share of a night it only partly
 * received: `SleepStageSlice.share` is null unless deep, REM and core all
 * arrived, and the panel prints a sentence saying exactly that — "no
 * percentages are shown: they would be a share of part of a night."
 *
 * The bar underneath it was drawn from `minutes / stagedMinutes`, which is the
 * share the engine had just declined to publish. A watch that reported deep
 * sleep alone got a deep bar filled the whole way across, directly under the
 * sentence explaining why no percentage could be given. The number was
 * withheld and the picture said it anyway, and on a panel like this the
 * picture is what gets read.
 *
 * So the width comes from the same value as the number now, and when there is
 * no share to state the bars change meaning explicitly:
 *
 * `night`    — every stage arrived. The bar is the share of the night, the
 *              same number printed beside it.
 * `reported` — some stages are missing. The bars are scaled to the largest
 *              stage that did arrive, so they compare measured minutes against
 *              each other and claim nothing about the night. The panel says so
 *              in words, and they are drawn in a muted fill rather than the
 *              stage colours, because a bar that looks like the other kind is
 *              the other kind as far as the athlete is concerned.
 * `none`     — there is nothing a bar could compare. One stage on its own
 *              would be a full-width bar every time, which is not a
 *              measurement of anything; so would a set of stages all at zero
 *              minutes. The minutes are printed and no bar is drawn.
 *
 * Pure and total.
 */

export type StageBarBasis = "night" | "reported" | "none";

export type StageBar = {
  readonly stage: SleepStage;
  readonly minutes: number;
  /** The share of the night, or null when the engine would not state one. */
  readonly share: number | null;
  /** 0–100 against `basis`, or null when no bar should be drawn at all. */
  readonly widthPercent: number | null;
};

export type StageBars = {
  readonly basis: StageBarBasis;
  /** In `SLEEP_STAGE_ORDER`, deepest first, carrying only the stages that arrived. */
  readonly bars: readonly StageBar[];
};

export function stageBars(slices: readonly SleepStageSlice[]): StageBars {
  const bySt = new Map<SleepStage, SleepStageSlice>();
  for (const slice of slices) bySt.set(slice.stage, slice);
  const present = SLEEP_STAGE_ORDER.flatMap((stage) => {
    const slice = bySt.get(stage);
    return slice ? [slice] : [];
  });

  // A share for every stage is the only case in which a bar may be read as a
  // share, and then the width is that share rather than a second calculation
  // of it.
  if (present.length > 0 && present.every((slice) => slice.share !== null)) {
    return {
      basis: "night",
      bars: present.map((slice) => ({
        stage: slice.stage,
        minutes: slice.minutes,
        share: slice.share,
        widthPercent: (slice.share ?? 0) * 100,
      })),
    };
  }

  const peak = present.reduce((most, slice) => Math.max(most, slice.minutes), 0);
  const comparable = present.length >= 2 && peak > 0;
  return {
    basis: comparable ? "reported" : "none",
    bars: present.map((slice) => ({
      stage: slice.stage,
      minutes: slice.minutes,
      share: null,
      widthPercent: comparable ? (slice.minutes / peak) * 100 : null,
    })),
  };
}
