import type { ReportStats } from "./medical-report.server";
import type { ReportSource } from "./medical-report.schema";

/**
 * Whether a figure on the 30-day report was measured, was looked for and not
 * found, or could not be looked for at all.
 *
 * The stats this report is built from already carry `unreadable`: the list of
 * sources whose query failed, kept apart from sources that simply had nothing
 * in them. Its own type says why that distinction matters more here than
 * anywhere else in the app — "no sessions" is a claim about the athlete, "could
 * not be read" is a claim about us — and the prompt tells the model the same
 * thing twice.
 *
 * Both of the places that actually print the figures ignored it. The summary
 * grid on screen and the one in the PDF read `stats.sessions` straight out and
 * printed it, so a failed read of the training sessions put "0" and "0 kg" in
 * front of a physician: a document stating this athlete did not train for a
 * month, when the truth was that we could not tell.
 *
 * So the figures go through here. Nothing renders a number without saying
 * which of the three it is.
 */
export type ReportFigure =
  | { readonly state: "measured"; readonly value: number }
  | { readonly state: "absent" }
  | { readonly state: "unreadable"; readonly source: ReportSource };

/** Which read each figure on the report depends on. */
export const FIGURE_SOURCES = {
  sessions: "training sessions",
  sessionsPerWeek: "training sessions",
  trainingMinutes: "training sessions",
  avgSessionMinutes: "training sessions",
  totalVolumeKg: "logged sets",
  checkins: "daily check-ins",
  avgReadiness: "daily check-ins",
  avgSleepHours: "daily check-ins",
  avgSoreness: "daily check-ins",
  avgStress: "daily check-ins",
  avgEnergy: "daily check-ins",
  nutritionDaysLogged: "nutrition log",
  avgKcal: "nutrition log",
  avgProtein: "nutrition log",
  avgCarbs: "nutrition log",
  avgFat: "nutrition log",
  weightStartKg: "body measurements",
  weightEndKg: "body measurements",
  weightDeltaKg: "body measurements",
  bodyFatStart: "body measurements",
  bodyFatEnd: "body measurements",
} as const satisfies Record<string, ReportSource>;

export type ReportFigureKey = keyof typeof FIGURE_SOURCES;

/**
 * One figure off the report's stats, with its provenance.
 *
 * A count is absent when its source could not be read and zero otherwise —
 * `sessions: 0` from a successful read is a real "you trained nothing this
 * month", and it must keep saying so. An average is already null when there
 * was nothing to average.
 */
export function reportFigure(
  stats: Pick<ReportStats, "unreadable"> & Partial<Record<ReportFigureKey, number | null>>,
  key: ReportFigureKey,
): ReportFigure {
  const source = FIGURE_SOURCES[key];
  if (stats.unreadable.includes(source)) return { state: "unreadable", source };
  const value = stats[key];
  if (value === null || value === undefined || !Number.isFinite(value)) return { state: "absent" };
  return { state: "measured", value };
}

/**
 * A figure as text, given how to render a measured one.
 *
 * `absent` and `unreadable` get different marks on purpose: an em dash reads
 * as "nothing here", and nothing here is not what a failed query means.
 */
export function formatReportFigure(
  figure: ReportFigure,
  render: (value: number) => string,
  marks: { absent: string; unreadable: string },
): string {
  if (figure.state === "measured") return render(figure.value);
  return figure.state === "absent" ? marks.absent : marks.unreadable;
}

/**
 * The sources that could not be read, in the order the report names them, with
 * duplicates and anything unrecognised dropped.
 *
 * Printed from the stats rather than taken from the model's `dataGaps`. The
 * model is asked to list them and usually does, but a document a physician
 * reads cannot have "we could not read your training log" depend on whether a
 * language model remembered to mention it.
 */
export function unreadableSources(
  stats: Pick<ReportStats, "unreadable">,
  order: readonly ReportSource[],
): ReportSource[] {
  return order.filter((source) => stats.unreadable.includes(source));
}
