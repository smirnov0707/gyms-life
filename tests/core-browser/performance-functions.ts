// Deterministic service boundary; no database or account requests.
import { state, count } from "./state";
async function read(source: string) {
  count("performance-" + source);
  while (state.fail === "performance-" + source + "-pending")
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (state.fail === "performance-" + source)
    throw new Error("Synthetic performance source unavailable");
  return new URLSearchParams(location.search).get("scenario") === "empty";
}
export async function getPerformanceOverview() {
  const empty = await read("overview");
  return {
    status: "READY",
    metrics: {
      workouts: empty ? 0 : 16,
      totalVolume: empty ? 0 : 12340,
      totalSets: empty ? 0 : 48,
      totalReps: empty ? 0 : 384,
      totalDurationSeconds: 0,
      averageRpe: null,
    },
    exercises: empty
      ? []
      : [
          {
            exerciseSlug: "press",
            exerciseName: "Synthetic press",
            sessions: 8,
            totalSets: 24,
            totalReps: 192,
            totalVolume: 6400,
            bestWeightKg: 60,
            bestReps: 8,
            bestEstimated1RMKg: 76,
            averageRpe: 7,
            latest: null,
          },
          {
            exerciseSlug: "row",
            exerciseName: "Synthetic row",
            sessions: 8,
            totalSets: 24,
            totalReps: 192,
            totalVolume: 5940,
            bestWeightKg: null,
            bestReps: null,
            bestEstimated1RMKg: null,
            averageRpe: null,
            latest: null,
          },
        ],
  };
}
export async function getVolumeTrend() {
  const empty = await read("volume");
  return {
    status: "READY",
    points: empty
      ? []
      : Array.from({ length: 16 }, (_, i) => ({
          date: new Date(Date.UTC(2026, 8, 16 - i, 12)).toISOString(),
          workout: `Session ${16 - i}`,
          volume: i === 0 ? 0 : (16 - i) * 100,
          durationSeconds: 0,
        })),
  };
}
export async function getStrengthTrend() {
  const empty = await read("strength");
  return {
    status: "READY",
    points: empty
      ? []
      : [
          ...Array.from({ length: 16 }, (_, i) => ({
            exerciseSlug: "press",
            exerciseName: "Synthetic press",
            date: new Date(Date.UTC(2026, 8, 16 - i, 12)).toISOString(),
            estimated1RMKg: 60 + 16 - i,
          })),
          {
            exerciseSlug: "squat",
            exerciseName: "Synthetic squat",
            date: "2026-09-10T12:00:00Z",
            estimated1RMKg: 150,
          },
          {
            exerciseSlug: "squat",
            exerciseName: "Synthetic squat",
            date: "2026-09-16T12:00:00Z",
            estimated1RMKg: 160,
          },
        ],
  };
}
