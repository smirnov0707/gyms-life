import { describe, expect, it } from "vitest";
import {
  AI_TASK_CONTEXT_SCOPE,
  NAMED_AI_TASKS,
  OTHER_PERSONALIZED_AI_TASK_COUNT,
  PERSONALIZED_AI_TASKS,
} from "./ai-task-context";

/**
 * The privacy card used to name two features beside a table of twenty-six, and
 * seventeen of those tasks send the athlete's summaries and memory facts. The
 * card was wrong the moment a third task became personalized, and nothing
 * could notice. These are the properties that make the number on screen the
 * table's number rather than a remembered one.
 */

describe("what the athlete's context is sent with", () => {
  it("counts only the tasks actually marked personalized", () => {
    for (const task of PERSONALIZED_AI_TASKS) {
      expect(AI_TASK_CONTEXT_SCOPE[task]).toBe("personalized");
    }
    const marked = Object.values(AI_TASK_CONTEXT_SCOPE).filter(
      (scope) => scope === "personalized",
    ).length;
    expect(PERSONALIZED_AI_TASKS).toHaveLength(marked);
  });

  it("names only tasks that are themselves personalized", () => {
    // Naming a task that does not send context would understate nothing and
    // overstate everything: the card would be describing a promise it is not
    // making.
    for (const task of NAMED_AI_TASKS) {
      expect(AI_TASK_CONTEXT_SCOPE[task]).toBe("personalized");
    }
  });

  it("counts the rest without double-counting the named ones", () => {
    // The reason this constant exists. Coach and the daily brief are four
    // tasks between them, so a card saying "and N minus two others" is wrong
    // by two — which is what the first attempt at this said.
    expect(OTHER_PERSONALIZED_AI_TASK_COUNT).toBe(
      PERSONALIZED_AI_TASKS.length - NAMED_AI_TASKS.length,
    );
    expect(NAMED_AI_TASKS.length).toBeGreaterThan(2);
  });

  it("never reports a negative or absurd number to put on screen", () => {
    expect(OTHER_PERSONALIZED_AI_TASK_COUNT).toBeGreaterThanOrEqual(0);
    expect(OTHER_PERSONALIZED_AI_TASK_COUNT).toBeLessThan(PERSONALIZED_AI_TASKS.length);
  });

  it("keeps translation and vision-only work out of the personalized set", () => {
    // These take the thing they are given and nothing about the athlete.
    for (const task of ["meal-translation", "plan-translation", "supplement-vision"] as const) {
      expect(AI_TASK_CONTEXT_SCOPE[task]).toBe("none");
    }
  });
});
