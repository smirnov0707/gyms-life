import { describe, expect, it } from "vitest";
import { contextualActionsFor } from "./action-layer";

describe("contextualActionsFor", () => {
  it("does not duplicate Today-native check-in and food logging in the global action drawer", () => {
    const intents = contextualActionsFor("today").map((action) => action.intent);

    expect(intents).toEqual(["movement"]);
    expect(intents).not.toContain("workout");
    expect(intents).not.toContain("coach");
    expect(intents).not.toContain("checkin");
    expect(intents).not.toContain("nutrition");
  });

  it("keeps world navigation out of the action drawer", () => {
    for (const world of ["today", "twin", "lab", "coach"] as const) {
      expect(contextualActionsFor(world).map((action) => action.intent)).not.toContain("coach");
    }
  });

  it("keeps check-in and nutrition available away from Today", () => {
    for (const world of ["twin", "lab", "coach"] as const) {
      const actions = contextualActionsFor(world);
      const intents = actions.map((action) => action.intent);
      expect(intents).toContain("checkin");
      expect(intents).toContain("nutrition");
      expect(actions.find((action) => action.intent === "nutrition")?.to).toBe("/nutrition");
    }
  });
});
