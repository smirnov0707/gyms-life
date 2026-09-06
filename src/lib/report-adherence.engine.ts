/**
 * How closely the athlete followed their own plan over the report window.
 *
 * This used to be asked of a language model, on a document whose system
 * prompt opens with "Accuracy is everything" and which the athlete hands to a
 * physician. The prompt even spelled out the arithmetic — training frequency
 * against goal, check-ins out of thirty, nutrition days out of thirty — while
 * every one of those numbers was already computed and sitting in the report's
 * own stats. Describing a calculation to a model instead of performing it is
 * how a badge reading "73/100" ends up in front of a doctor with nothing
 * behind it.
 *
 * Three components, each a share of what was possible, averaged over the ones
 * that could be measured. A component with no basis is named rather than
 * counted as zero: an athlete who never told us how often they intend to
 * train has not failed to train that often.
 */

export const REPORT_WINDOW_DAYS = 30;
/** The bands the report's badge already coloured by. */
export const ADHERENCE_HIGH_FROM = 70;
export const ADHERENCE_MODERATE_FROM = 40;

export type AdherenceComponentKey = "training" | "checkins" | "nutrition";

export type AdherenceInput = {
  /** Completed sessions per week over the window. */
  sessionsPerWeek: number;
  /** The athlete's own target, from their profile. Null when never stated. */
  plannedSessionsPerWeek: number | null;
  /** Days with a readiness check-in, out of the window. */
  checkins: number;
  /** Days with at least one meal logged, out of the window. */
  nutritionDaysLogged: number;
};

export type AdherenceComponent = {
  key: AdherenceComponentKey;
  /** 0-100, already capped: exceeding the plan is full marks, not a bonus. */
  percent: number;
  /** The two numbers the percent came from, so the report can show its work. */
  actual: number;
  possible: number;
};

export type AdherenceResult = {
  /** Null when nothing could be measured — never a zero standing in for it. */
  score: number | null;
  band: "high" | "moderate" | "low" | null;
  measured: AdherenceComponent[];
  /** Components with no basis, so the report can say what it could not judge. */
  unmeasured: AdherenceComponentKey[];
};

const share = (actual: number, possible: number): number =>
  Math.max(0, Math.min(100, Math.round((actual / possible) * 100)));

export function calculateReportAdherence(input: AdherenceInput): AdherenceResult {
  const measured: AdherenceComponent[] = [];
  const unmeasured: AdherenceComponentKey[] = [];

  if (input.plannedSessionsPerWeek !== null && input.plannedSessionsPerWeek > 0) {
    measured.push({
      key: "training",
      percent: share(input.sessionsPerWeek, input.plannedSessionsPerWeek),
      actual: input.sessionsPerWeek,
      possible: input.plannedSessionsPerWeek,
    });
  } else {
    unmeasured.push("training");
  }

  measured.push({
    key: "checkins",
    percent: share(input.checkins, REPORT_WINDOW_DAYS),
    actual: input.checkins,
    possible: REPORT_WINDOW_DAYS,
  });
  measured.push({
    key: "nutrition",
    percent: share(input.nutritionDaysLogged, REPORT_WINDOW_DAYS),
    actual: input.nutritionDaysLogged,
    possible: REPORT_WINDOW_DAYS,
  });

  if (measured.length === 0) return { score: null, band: null, measured, unmeasured };

  const score = Math.round(
    measured.reduce((total, component) => total + component.percent, 0) / measured.length,
  );

  return {
    score,
    band:
      score >= ADHERENCE_HIGH_FROM ? "high" : score >= ADHERENCE_MODERATE_FROM ? "moderate" : "low",
    measured,
    unmeasured,
  };
}
