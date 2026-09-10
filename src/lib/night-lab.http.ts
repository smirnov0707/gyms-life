import type { JobRunReport } from "./background-job.server";
/** Failed or unrecorded agent work must be visible to the invoking scheduler. */
export function nightLabHttpStatus(report: JobRunReport): 200 | 503 {
  return report.status === "unavailable" ||
    (report.status === "ran" && (!report.recorded || report.outcome.status === "failed"))
    ? 503
    : 200;
}
