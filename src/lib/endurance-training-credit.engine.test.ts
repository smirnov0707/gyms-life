import { describe, expect, it } from "vitest";
import { EnduranceActivitySchema } from "./endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "./endurance-training-credit.engine";

describe("endurance training credit", () => {
  it("credits a treadmill run as real endurance training", () => {
    const activity = EnduranceActivitySchema.parse({
      kind: "run",
      environment: "treadmill",
      source: "manual",
      startedAt: "2026-10-06T06:00:00+03:00",
      durationSeconds: 2700,
      distanceMeters: 7000,
      perceivedEffort: 6,
    });

    expect(buildEnduranceTrainingCredit(activity)).toEqual({
      status: "credited",
      discipline: "endurance",
      durationMinutes: 45,
      distanceKm: 7,
      workload: { basis: "duration_x_rpe", value: 270 },
      completion: "meaningful_session",
    });
  });

  it("keeps an outdoor run comparable without inventing RPE", () => {
    const activity = EnduranceActivitySchema.parse({
      kind: "run",
      environment: "outdoor",
      source: "wearable",
      startedAt: "2026-10-06T06:00:00+03:00",
      durationSeconds: 1800,
      distanceMeters: 5000,
    });

    const credit = buildEnduranceTrainingCredit(activity);
    expect(credit.status).toBe("credited");
    if (credit.status !== "credited") throw new Error("Expected credited endurance activity.");
    expect(credit.workload).toEqual({
      basis: "duration",
      value: 30,
    });
  });
});
