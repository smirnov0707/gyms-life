import type { TwinTrendHistory } from "../../src/lib/twin-trend";
import { state, count, delay } from "./state";
export { forecastProgress } from "../today-browser/reference-functions";
export async function getTwinTrendHistory(): Promise<TwinTrendHistory> {
  count("getTwinTrendHistory");
  while (state.fail === "observed-pending") await delay();
  if (state.fail === "observed") throw new Error("UNTRUSTED_SYNTHETIC_OBSERVED_FAILURE");
  const scenario = new URLSearchParams(location.search).get("scenario");
  const days =
    scenario === "empty"
      ? []
      : scenario === "single"
        ? [1]
        : scenario === "short-span"
          ? [0.3, 0.2, 0.1, 0]
          : [120, 60, 10, 6, 3, 1];
  return {
    points: days.map((day, i) => ({
      id: `synthetic-observation-${i}`,
      computedAt: new Date(Date.now() - day * 86400000).toISOString(),
      schemaVersion: "1.7",
      calculationVersion: "synthetic",
      metrics: {
        sessionsLast7Days: 3,
        totalVolumeLast28Days: i * 1250,
        readiness: 60 + i,
        sleepHours: 7 + i / 10,
        weightKg: null,
        calories: null,
        proteinG: null,
      },
      regions: [],
    })),
    omittedCount: scenario === "empty" ? 0 : 1,
    incompatibleCount: scenario === "empty" ? 0 : 2,
    hasMore: scenario !== "empty",
    limit: 60,
  };
}
