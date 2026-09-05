import { describe, expect, it } from "vitest";
import { calculateMuscleGroupLoad } from "./muscle-load.engine";

const exercises = [
  { slug: "bench-press", muscle_group: "chest" },
  { slug: "squat", muscle_group: "legs" },
];

describe("calculateMuscleGroupLoad", () => {
  it("accumulates volume and estimates recovery per muscle group", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const sets = [
      {
        exercise_slug: "bench-press",
        reps: 5,
        weight_kg: 100,
        done: true,
        performed_at: "2026-09-04T10:00:00.000Z",
      },
      {
        exercise_slug: "bench-press",
        reps: 5,
        weight_kg: 100,
        done: true,
        performed_at: "2026-09-04T10:05:00.000Z",
      },
    ];

    const result = calculateMuscleGroupLoad(sets, exercises, now);

    expect(result).toHaveLength(1);
    expect(result[0]?.muscleGroup).toBe("chest");
    expect(result[0]?.volumeKg).toBe(1000);
    expect(result[0]?.recoveryPct).toBeLessThan(100);
    expect(result[0]?.lastTrainedHoursAgo).toBe(2);
  });

  it("ignores sets that were not completed", () => {
    const result = calculateMuscleGroupLoad(
      [
        {
          exercise_slug: "squat",
          reps: 5,
          weight_kg: 100,
          done: false,
          performed_at: "2026-09-04T10:00:00.000Z",
        },
      ],
      exercises,
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(result).toHaveLength(0);
  });

  it("ignores sets whose exercise has no known muscle group", () => {
    const result = calculateMuscleGroupLoad(
      [
        {
          exercise_slug: "unknown-exercise",
          reps: 5,
          weight_kg: 100,
          done: true,
          performed_at: "2026-09-04T10:00:00.000Z",
        },
      ],
      exercises,
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(result).toHaveLength(0);
  });

  it("estimates full recovery long after training and fresh fatigue right after", () => {
    const now = new Date("2026-09-11T12:00:00.000Z");
    const staleSet = {
      exercise_slug: "squat",
      reps: 5,
      weight_kg: 100,
      done: true,
      performed_at: "2026-08-01T12:00:00.000Z",
    };
    const freshSet = {
      exercise_slug: "bench-press",
      reps: 10,
      weight_kg: 150,
      done: true,
      performed_at: "2026-09-11T11:00:00.000Z",
    };

    const result = calculateMuscleGroupLoad([staleSet, freshSet], exercises, now);
    const stale = result.find((r) => r.muscleGroup === "legs");
    const fresh = result.find((r) => r.muscleGroup === "chest");

    expect(stale?.recoveryPct).toBe(100);
    expect(fresh?.recoveryPct).toBeLessThan(100);
    // Sorted most-fatigued first.
    expect(result[0]?.muscleGroup).toBe("chest");
  });

  it("never reports recovery below zero regardless of accumulated volume", () => {
    const now = new Date("2026-09-04T12:00:01.000Z");
    const sets = Array.from({ length: 20 }, () => ({
      exercise_slug: "bench-press",
      reps: 10,
      weight_kg: 200,
      done: true,
      performed_at: "2026-09-04T12:00:00.000Z",
    }));

    const result = calculateMuscleGroupLoad(sets, exercises, now);
    expect(result[0]?.recoveryPct).toBeGreaterThanOrEqual(0);
  });

  it("rejects malformed source rows instead of silently coercing them", () => {
    expect(() =>
      calculateMuscleGroupLoad(
        [
          {
            exercise_slug: "bench-press",
            // @ts-expect-error intentionally invalid input for the boundary check
            reps: "5",
            weight_kg: 100,
            done: true,
            performed_at: "2026-09-04T10:00:00.000Z",
          },
        ],
        exercises,
      ),
    ).toThrow();
  });
});

describe("performance time versus write time", () => {
  it("decays fatigue from when the set was performed, not when it synced", () => {
    // The case this column exists for: a set done in a basement gym last
    // night, synced when signal returned this morning. Dating it to the sync
    // would report the muscle as far more fatigued than it is.
    const now = new Date("2026-09-05T09:00:00.000Z");
    const lastNight = [
      {
        exercise_slug: "squat",
        reps: 10,
        weight_kg: 100,
        done: true,
        performed_at: "2026-09-04T19:00:00.000Z",
      },
    ];
    const asIfSyncedNow = [{ ...lastNight[0]!, performed_at: now.toISOString() }];

    const real = calculateMuscleGroupLoad(lastNight, exercises, now);
    const wrong = calculateMuscleGroupLoad(asIfSyncedNow, exercises, now);

    expect(real[0]?.recoveryPct).toBeGreaterThan(wrong[0]?.recoveryPct ?? 0);
    expect(real[0]?.lastTrainedHoursAgo).toBe(14);
    expect(wrong[0]?.lastTrainedHoursAgo).toBe(0);
  });
});
