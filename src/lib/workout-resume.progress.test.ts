import { describe, expect, it } from "vitest";
import { restoreWorkoutProgress, completedWorkoutSetNumbers } from "./workout-resume.progress";
import { nextSetNumber } from "./workout-set-prefill";
import type { OfflinePayload } from "./offline-store";
import { trainingPlan } from "../../tests/core-browser/fixtures";
const workout = {
    ...trainingPlan.days[0]!,
    exercises: trainingPlan.days[0]!.exercises.slice(0, 2),
  },
  session = "55555555-5555-4555-8555-555555555555";
const slug = workout.exercises[0]!.slug,
  second = workout.exercises[1]!.slug;
const log = (number: number, exercise = slug, done = true) => ({
  exercise_slug: exercise,
  set_number: number,
  done,
});
const queued = (number: number, id = session, exercise = slug): OfflinePayload => ({
  id: "queue-" + number,
  type: "workout_set",
  timestamp: 1,
  data: {
    sessionId: id,
    exerciseSlug: exercise,
    exerciseName: exercise,
    setNumber: number,
    reps: 8,
    weightKg: 20,
    rpe: null,
    done: true,
  },
});
describe("restored workout tracks set numbers rather than row count", () => {
  it("an extra set does not hide a missing planned set", () =>
    expect(restoreWorkoutProgress(workout, session, [log(1), log(3), log(4)], [])).toEqual({
      exerciseIndex: 0,
      setNumber: 2,
    }));
  it("deduplicates server and offline observations and includes only this confirmed session", () => {
    const numbers = completedWorkoutSetNumbers(
      session,
      slug,
      [log(1)],
      [queued(1), queued(2), queued(3, "another-session"), queued(3, session, second)],
    );
    expect([...numbers]).toEqual([1, 2]);
    expect(restoreWorkoutProgress(workout, session, [log(1)], [queued(1), queued(2)])).toEqual({
      exerciseIndex: 0,
      setNumber: 3,
    });
  });
  it("unconfirmed or unfinished logs do not advance progress", () =>
    expect(
      restoreWorkoutProgress(workout, session, [log(1, slug, false), log(2), log(3)], []).setNumber,
    ).toBe(1));
  it("resumes the next incomplete exercise after all planned sets were actually done", () =>
    expect(
      restoreWorkoutProgress(workout, session, [log(1), log(2), log(3), log(1, second)], []),
    ).toEqual({ exerciseIndex: 1, setNumber: 2 }));
  it("completed work plus an extra set resumes beyond the highest actual number", () => {
    const rows = [1, 2, 3].flatMap((n) => [log(n), log(n, second)]);
    rows.push(log(7, second));
    expect(restoreWorkoutProgress(workout, session, rows, [])).toEqual({
      exerciseIndex: 1,
      setNumber: 8,
    });
  });
  it("recording a missing set advances past the already recorded later set", () => {
    const numbers = completedWorkoutSetNumbers(session, slug, [log(1), log(3)], []);
    expect(nextSetNumber(3, numbers)).toBe(2);
    numbers.add(2);
    expect(nextSetNumber(3, numbers)).toBe(4);
  });
  it("rejects a saved workout with no exercises", () =>
    expect(() => restoreWorkoutProgress({ ...workout, exercises: [] }, session, [], [])).toThrow());
});
