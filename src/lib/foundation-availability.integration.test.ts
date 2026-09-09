import { describe, expect, it } from "vitest";
import { DigitalAthleteSourcesSchema, DigitalAthleteStateSchema } from "./digital-athlete.schema";
import { buildDigitalAthleteState } from "./digital-athlete.service";
import { canPersistDigitalAthleteState } from "./athlete-state-snapshot.server";
const domains = DigitalAthleteSourcesSchema.shape.availability.keyof().options;
const empty = {
  workouts: [],
  workoutResponses: [],
  checkins: [],
  bodyMetrics: [],
  nutritionLogs: [],
  decisionFeedback: [],
  lifeContexts: [],
  trainingRhythm: null,
  setLogs: [],
  exerciseMuscleGroups: [],
};
const stateFor = (mask: number) =>
  buildDigitalAthleteState(
    DigitalAthleteSourcesSchema.parse({
      ...empty,
      availability: Object.fromEntries(
        domains.map((name, index) => [name, Boolean(mask & (1 << index))]),
      ),
    }),
    new Date("2026-09-09T12:00:00Z"),
    "Europe/Vilnius",
  );
describe("integrated source completeness prerequisite", () => {
  it("allows a readable cold-start history but rejects every combination containing a source failure", () => {
    // All 512 source-state combinations, including the two former suffix misses.
    expect(domains).toHaveLength(9);
    for (let mask = 0; mask < 2 ** domains.length; mask++)
      expect(canPersistDigitalAthleteState(stateFor(mask)), `availability bitmask ${mask}`).toBe(
        mask === 2 ** domains.length - 1,
      );
  });
  it.each(["personalization_consent_required", "personalization_consent_unavailable"] as const)(
    "never promotes %s into canonical history",
    (gap) => {
      const state = stateFor(2 ** domains.length - 1);
      expect(canPersistDigitalAthleteState({ ...state, dataGaps: [...state.dataGaps, gap] })).toBe(
        false,
      );
    },
  );
  it("does not accept a future unclassified source failure through schema decoding", () => {
    const state = stateFor(2 ** domains.length - 1);
    expect(
      DigitalAthleteStateSchema.safeParse({ ...state, dataGaps: ["future_source_unavailable"] })
        .success,
    ).toBe(false);
  });
});
