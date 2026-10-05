import type { EnduranceActivity } from "./endurance-activity.schema";

export type EnduranceTrainingCredit =
  | { status: "invalid"; reason: "activity_invalid" }
  | {
      status: "credited";
      discipline: "endurance";
      durationMinutes: number;
      distanceKm: number | null;
      /** Observable workload only. This is not converted into strength volume. */
      workload: {
        basis: "duration" | "duration_x_rpe";
        value: number;
      };
      completion: "meaningful_session";
    };

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Converts a completed endurance activity into canonical training evidence.
 *
 * Credit answers "did meaningful training occur and how much observable work
 * was logged?" It deliberately does not award points, calories, strength kg,
 * VO2max, or recovery cost that the source data cannot establish.
 */
export function buildEnduranceTrainingCredit(
  activity: EnduranceActivity,
): EnduranceTrainingCredit {
  if (!Number.isFinite(activity.durationSeconds) || activity.durationSeconds <= 0) {
    return { status: "invalid", reason: "activity_invalid" };
  }

  const durationMinutes = round1(activity.durationSeconds / 60);
  const distanceKm =
    activity.distanceMeters !== null && Number.isFinite(activity.distanceMeters)
      ? round1(activity.distanceMeters / 1000)
      : null;

  const rpe = activity.perceivedEffort;
  const workload =
    rpe !== null
      ? { basis: "duration_x_rpe" as const, value: round1(durationMinutes * rpe) }
      : { basis: "duration" as const, value: durationMinutes };

  return {
    status: "credited",
    discipline: "endurance",
    durationMinutes,
    distanceKm,
    workload,
    completion: "meaningful_session",
  };
}
