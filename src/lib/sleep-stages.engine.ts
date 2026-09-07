/**
 * How the athlete's last recorded night was spent, from what the source
 * actually reported about it.
 *
 * The template draws a sleep panel with four bars that always add to a full
 * night. Real sources are not like that: some report only a duration, some
 * report three stages, some report four, and the stages a source does report
 * rarely add up to the duration it reported beside them. So the shapes below
 * keep those cases apart instead of averaging them into one bar chart — a
 * night with no stages says it has no stages, and minutes nobody attributed to
 * a stage are shown as unattributed rather than folded into the largest one.
 *
 * Pure and total.
 */

export type SleepStage = "deep" | "rem" | "core" | "awake";

/** The order the stages are drawn in: deepest first, awake last. */
export const SLEEP_STAGE_ORDER: readonly SleepStage[] = ["deep", "rem", "core", "awake"];

export type SleepStageRow = {
  sample_on: string;
  source: string;
  sleep_hours: number | null;
  sleep_awake_minutes: number | null;
  sleep_rem_minutes: number | null;
  sleep_deep_minutes: number | null;
  sleep_core_minutes: number | null;
};

export type SleepStageSlice = {
  stage: SleepStage;
  minutes: number;
  /**
   * Fraction of the recorded night, or null when a share would be a lie.
   *
   * A source that reported deep sleep alone would otherwise show deep sleep as
   * 100% of the night. Shares are computed only when all three sleep stages
   * are present, so the denominator is a whole night rather than the part
   * that happened to be sent.
   */
  share: number | null;
};

export type SleepNight =
  /** The samples could not be read. Not the same as never having slept. */
  | { status: "unreadable" }
  /** No sample in the window at all. */
  | { status: "absent" }
  /** A night was recorded, with a duration and no stages. */
  | {
      status: "duration_only";
      night: string;
      source: string;
      sleepHours: number | null;
      ageDays: number;
    }
  | {
      status: "staged";
      night: string;
      source: string;
      sleepHours: number | null;
      ageDays: number;
      slices: SleepStageSlice[];
      /** Minutes the source placed in a stage. */
      stagedMinutes: number;
      /**
       * Minutes of reported sleep that no stage accounts for, or null when
       * there is no duration to compare against or the stages cover it.
       */
      unattributedMinutes: number | null;
    };

const dayDistance = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The most recent night, and what is known about it.
 *
 * Rows are expected newest first, as every read in this codebase orders them,
 * but the newest is picked rather than assumed so a differently ordered caller
 * cannot silently show an old night as last night.
 */
export function buildSleepNight(input: {
  rows: readonly SleepStageRow[] | null;
  today: string;
}): SleepNight {
  if (input.rows === null) return { status: "unreadable" };
  if (input.rows.length === 0) return { status: "absent" };

  let newest = input.rows[0];
  for (const row of input.rows) {
    if (newest === undefined || row.sample_on > newest.sample_on) newest = row;
  }
  if (newest === undefined) return { status: "absent" };

  const ageDays = dayDistance(newest.sample_on, input.today);
  const sleepHours = typeof newest.sleep_hours === "number" ? newest.sleep_hours : null;

  const minutes: Record<SleepStage, number | null> = {
    deep: newest.sleep_deep_minutes,
    rem: newest.sleep_rem_minutes,
    core: newest.sleep_core_minutes,
    awake: newest.sleep_awake_minutes,
  };

  const reported = SLEEP_STAGE_ORDER.filter((stage) => typeof minutes[stage] === "number");
  if (reported.length === 0) {
    return {
      status: "duration_only",
      night: newest.sample_on,
      source: newest.source,
      sleepHours,
      ageDays,
    };
  }

  const stagedMinutes = reported.reduce((sum, stage) => sum + (minutes[stage] ?? 0), 0);
  // A share needs a whole night behind it. Time awake is not required: it sits
  // inside the window in bed rather than inside the sleep, and a source that
  // reports the three sleep stages has described the night.
  const wholeNight =
    typeof minutes.deep === "number" &&
    typeof minutes.rem === "number" &&
    typeof minutes.core === "number";
  const denominator = stagedMinutes;

  const slices: SleepStageSlice[] = reported.map((stage) => ({
    stage,
    minutes: minutes[stage] ?? 0,
    share: wholeNight && denominator > 0 ? (minutes[stage] ?? 0) / denominator : null,
  }));

  const asleepMinutes = (minutes.deep ?? 0) + (minutes.rem ?? 0) + (minutes.core ?? 0);
  const gap = sleepHours === null ? null : Math.round(sleepHours * 60 - asleepMinutes);
  // Only a positive gap is worth showing: sleep the source reported and then
  // did not place anywhere. A negative one means the stages slightly exceed a
  // rounded duration, which is rounding rather than missing sleep.
  const unattributedMinutes = gap !== null && gap > 0 ? gap : null;

  return {
    status: "staged",
    night: newest.sample_on,
    source: newest.source,
    sleepHours,
    ageDays,
    slices,
    stagedMinutes,
    unattributedMinutes,
  };
}
