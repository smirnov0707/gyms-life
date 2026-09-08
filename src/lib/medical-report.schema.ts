/**
 * The names the 30-day report calls its own reads by.
 *
 * Kept apart from `medical-report.server.ts` because the two places that print
 * the report — the panel on screen and the PDF the athlete downloads — both
 * need this list to say which sources could not be read, and neither of them
 * may pull a server module into the browser bundle.
 */
export const REPORT_SOURCES = [
  "training sessions",
  "logged sets",
  "daily check-ins",
  "nutrition log",
  "body measurements",
  "supplements",
  "profile",
] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number];
