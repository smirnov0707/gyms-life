import { describe, expect, it } from "vitest";
import { exerciseAnatomy } from "./exercise-anatomy";

/**
 * Twenty-five of the catalogue's 175 exercises have an anatomy entry of their
 * own, so the interesting cases are the other 150: what this returns when it
 * does not know the movement, and whether the athlete can tell that from an
 * answer about the movement itself.
 */

describe("exerciseAnatomy", () => {
  it("names the muscles of an exercise it knows", () => {
    const anatomy = exerciseAnatomy("push-up", "chest");
    expect(anatomy?.primary).toBe("Pectoralis major");
    expect(anatomy?.scope).toBe("exercise");
  });

  it("marks a muscle-group answer as being about the group", () => {
    // "Roughly what chest work trains" is a different claim from "what this
    // movement trains", and the two used to render identically.
    const anatomy = exerciseAnatomy("cable-crossover-high-to-low", "chest");
    expect(anatomy?.primary).toBe("Pectoralis major");
    expect(anatomy?.scope).toBe("group");
  });

  it("says nothing for work that has no primary agonist to name", () => {
    // Cardio, mobility and full-body work are 29 exercises in the catalogue.
    // They used to come back as "Primary target muscles" — a phrase shaped
    // exactly like anatomy, containing none, under the same heading as a real
    // entry.
    expect(exerciseAnatomy("treadmill-run", "cardio")).toBeNull();
    expect(exerciseAnatomy("hip-opener", "mobility")).toBeNull();
    expect(exerciseAnatomy("burpee", "fullbody")).toBeNull();
  });

  it("says nothing when it has neither a movement nor a group", () => {
    expect(exerciseAnatomy(null, null)).toBeNull();
    expect(exerciseAnatomy("", "")).toBeNull();
    expect(exerciseAnatomy("something-nobody-added", "not-a-group")).toBeNull();
  });

  it("prefers the exercise's own entry over its group's", () => {
    const own = exerciseAnatomy("bench-dip", "chest");
    // Bench dips are a triceps movement filed under chest; the entry wins.
    expect(own?.primary).toBe("Triceps brachii");
    expect(own?.scope).toBe("exercise");
  });

  it("matches a slug whatever its casing", () => {
    expect(exerciseAnatomy("PUSH-UP", null)?.primary).toBe("Pectoralis major");
  });
});
