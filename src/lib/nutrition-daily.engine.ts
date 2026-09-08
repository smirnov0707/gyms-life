/**
 * A day's food log is many rows. The athlete's intake is their sum.
 *
 * `nutrition_logs` holds one row per logged item, and the Digital Athlete state
 * averaged those rows directly into fields called
 * `averageCaloriesOnLoggedDays` and `averageProteinGOnLoggedDays`. The names
 * say per day, the arithmetic was per entry, and `loggedDaysLast14Days` sits
 * beside them counting days — so the intent was never in doubt.
 *
 * Somebody logging five items of 400 kcal eats 2000 kcal that day. The state
 * reported 400, and sent it to every personalized AI task as the athlete's
 * average intake. A meal planner told that number will try to correct it.
 *
 * The defect survived because every test fixture logged exactly one row per
 * day, which is the one arrangement where the two arithmetics agree.
 *
 * Pure and total.
 */

export type NutritionLogEntry = {
  readonly logged_on: string;
  readonly calories: number;
  readonly protein: number;
};

export type DailyNutritionTotal = {
  readonly day: string;
  readonly calories: number;
  readonly proteinG: number;
};

/**
 * How many food-log rows one state calculation reads.
 *
 * Fourteen days at forty entries a day. The bound has to exist — an unbounded
 * read is a query that gets slower forever — but with per-day sums a bound is
 * no longer harmless: dropping rows no longer skews an average, it makes one
 * day's total too low while that day still counts as fully logged.
 */
export const NUTRITION_LOG_READ_LIMIT = 560;

/**
 * One total per logged day, newest first.
 *
 * `readTruncated` says the read came back at its limit. Rows arrive newest
 * first, so the only day that can be half-present is the oldest one, and it is
 * dropped rather than reported low. A missing day is visible in
 * `loggedDaysLast14Days`; a day that silently lost half its meals is not
 * visible anywhere.
 */
export function dailyNutritionTotals(
  entries: readonly NutritionLogEntry[],
  readTruncated = false,
): DailyNutritionTotal[] {
  const byDay = new Map<string, { calories: number; proteinG: number }>();
  for (const entry of entries) {
    if (!entry.logged_on) continue;
    if (!Number.isFinite(entry.calories) || !Number.isFinite(entry.protein)) continue;
    const total = byDay.get(entry.logged_on) ?? { calories: 0, proteinG: 0 };
    total.calories += entry.calories;
    total.proteinG += entry.protein;
    byDay.set(entry.logged_on, total);
  }

  const days = [...byDay.entries()]
    .map(([day, total]) => ({ day, calories: total.calories, proteinG: total.proteinG }))
    .sort((left, right) => (left.day < right.day ? 1 : left.day > right.day ? -1 : 0));

  // Nothing to protect when a single day is all there is: dropping it would
  // turn a partial reading into no reading, and the day count already says
  // how little there is.
  return readTruncated && days.length > 1 ? days.slice(0, -1) : days;
}

/** The mean of a day's totals, or null when no day was logged. */
export function averageDailyTotal(
  days: readonly DailyNutritionTotal[],
  pick: (day: DailyNutritionTotal) => number,
): number | null {
  if (days.length === 0) return null;
  const sum = days.reduce((total, day) => total + pick(day), 0);
  return Math.round((sum / days.length) * 10) / 10;
}
