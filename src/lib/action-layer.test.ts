import { describe, expect, it } from "vitest";
import { contextualActionsFor } from "./action-layer";

describe("contextualActionsFor", () => {
  it("does not duplicate Today-native check-in and food logging in the global action drawer", () => {
    const intents = contextualActionsFor("today").map((action) => action.intent);

    expect(intents).toEqual(["workout", "movement"]);
    expect(intents).not.toContain("checkin");
    expect(intents).not.toContain("nutrition");
  });

  it("keeps check-in and nutrition available away from Today", () => {
    for (const world of ["twin", "lab", "coach"] as const) {
      const intents = contextualActionsFor(world).map((action) => action.intent);
      expect(intents).toContain("checkin");
      expect(intents).toContain("nutrition");
    }
  });

  it("keeps Coach in primary navigation instead of duplicating it in the action drawer", () => {
    for (const world of ["today", "twin", "lab", "coach"] as const) {
      const intents = contextualActionsFor(world).map((action) => action.intent);
      expect(intents).not.toContain("coach");
    }
  });
});
