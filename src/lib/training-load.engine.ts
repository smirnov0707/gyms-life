/**
 * How much work the athlete actually moved this week, and how that compares
 * with the week before.
 *
 * Volume is weight × reps on completed sets, summed. Nothing here is modelled
 * or estimated: it is arithmetic on what was logged, which is why it can be
 * shown as a number rather than a band.
 *
 * The two rules that keep it honest:
 *
 *  - A set counts only when it is done and carries both a weight and reps.
 *    Bodyweight work is real training and is deliberately not guessed at, so
 *    it contributes nothing here — but the sets it excludes are counted and
 *    reported, because a total that quietly omits a third of the session is
 *    worse than one that says what it left out.
 *
 *  - A comparison needs two weeks of readable history. A first week is not a
 *    hundred-percent increase over nothing, and the panel says so instead.
 *
 * Pure and total.
 */

export type TrainingLoadSet = {
  /** ISO instant the set was performed, not when its row was written. */
  performed_at: string;
  reps: number | null;
  weight_kg: number | null;
  done: boolean | null;
};

export type TrainingLoadDay = {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  volumeKg: number;
};

export type TrainingLoad =
  /** The source could not be read. Not the same as a week without training. */
  | { status: "unreadable" }
  | {
      status: "counted";
      /** Seven days ending today, oldest first, so the bars read left to right. */
      days: TrainingLoadDay[];
      thisWeekKg: number;
      /** Null when the previous week is not covered by the window that was read. */
      lastWeekKg: number | null;
      /**
       * Change against last week, as a fraction. Null when there is nothing to
       * compare against — a first week is not an infinite improvement.
       */
      changeFraction: number | null;
      /** Completed sets that carried no usable weight × reps, so were not summed. */
      uncountedSets: number;
      /** Completed sets that were summed. */
      countedSets: number;
    };

/** Days in a comparison window. Two of these are read: this week and last. */
export const TRAINING_LOAD_WEEK_DAYS = 7;

function volumeOf(set: TrainingLoadSet): number | null {
  if (set.done !== true) return null;
  const reps = set.reps;
  const weight = set.weight_kg;
  if (reps === null || !Number.isFinite(reps) || reps <= 0) return null;
  if (weight === null || !Number.isFinite(weight) || weight <= 0) return null;
  return weight * reps;
}

const round = (value: number) => Math.round(value);

export function buildTrainingLoad(input: {
  /** Null when the query failed rather than returned nothing. */
  sets: readonly TrainingLoadSet[] | null;
  /** The athlete's local day, so a late-night set lands on the right date. */
  today: string;
  /** Maps an instant to the athlete's local day. Injected to stay pure. */
  dayOf: (instant: string) => string | null;
  /** Steps a local day backwards. Injected for the same reason. */
  shiftDay: (day: string, offset: number) => string;
  /**
   * False when the read did not reach back far enough to cover last week —
   * then there is no comparison to make, rather than a comparison against
   * zero.
   */
  coversLastWeek: boolean;
}): TrainingLoad {
  if (input.sets === null) return { status: "unreadable" };

  const thisWeekStart = input.shiftDay(input.today, -(TRAINING_LOAD_WEEK_DAYS - 1));
  const lastWeekStart = input.shiftDay(input.today, -(TRAINING_LOAD_WEEK_DAYS * 2 - 1));

  const byDay = new Map<string, number>();
  let thisWeekKg = 0;
  let lastWeekKg = 0;
  let countedSets = 0;
  let uncountedSets = 0;

  for (const set of input.sets) {
    if (set.done !== true) continue;
    const day = input.dayOf(set.performed_at);
    if (day === null) {
      // An unreadable timestamp is a set we cannot place in a week. It is not
      // dropped silently; it is one of the ones the panel says it could not
      // count.
      uncountedSets += 1;
      continue;
    }
    const volume = volumeOf(set);
    if (volume === null) {
      if (day >= lastWeekStart && day <= input.today) uncountedSets += 1;
      continue;
    }
    if (day > input.today || day < lastWeekStart) continue;

    countedSets += 1;
    if (day >= thisWeekStart) {
      thisWeekKg += volume;
      byDay.set(day, (byDay.get(day) ?? 0) + volume);
    } else {
      lastWeekKg += volume;
    }
  }

  const days: TrainingLoadDay[] = [];
  for (let offset = TRAINING_LOAD_WEEK_DAYS - 1; offset >= 0; offset -= 1) {
    const day = input.shiftDay(input.today, -offset);
    days.push({ day, volumeKg: round(byDay.get(day) ?? 0) });
  }

  const previous = input.coversLastWeek ? round(lastWeekKg) : null;
  return {
    status: "counted",
    days,
    thisWeekKg: round(thisWeekKg),
    lastWeekKg: previous,
    // Only against a week that actually held work. Dividing by zero, or
    // calling the first week an increase, would be inventing a trend.
    changeFraction:
      previous !== null && previous > 0 ? (round(thisWeekKg) - previous) / previous : null,
    countedSets,
    uncountedSets,
  };
}
