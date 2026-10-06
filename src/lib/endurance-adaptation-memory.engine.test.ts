import { describe, expect, it } from "vitest";
import { deriveAdaptationLesson } from "./endurance-adaptation-memory.engine";
describe("adaptation memory", () => {
  it("does not learn from one outcome", () =>
    expect(
      deriveAdaptationLesson([{ reason: "repeated_low_response", association: "improved_signals" }])
        .status,
    ).toBe("insufficient_evidence"));
  it("creates only a candidate after repeated support", () =>
    expect(
      deriveAdaptationLesson(
        [1, 2, 3].map(() => ({
          reason: "repeated_low_response",
          association: "improved_signals" as const,
        })),
      ).status,
    ).toBe("candidate"));
  it("creates a caution only after repeated worse outcomes", () => {
    const lesson = deriveAdaptationLesson(
      [1, 2, 3].map(() => ({
        reason: "repeated_over_target_work",
        association: "worse_signals" as const,
      })),
    );
    expect(lesson.status).toBe("caution");
    expect(lesson.reason).toBe("repeated_over_target_work");
    expect(lesson.supportingOutcomes).toBe(3);
  });
  it("does not call mixed evidence a caution", () =>
    expect(
      deriveAdaptationLesson([
        { reason: "repeated_low_response", association: "worse_signals" },
        { reason: "repeated_low_response", association: "worse_signals" },
        { reason: "repeated_low_response", association: "improved_signals" },
      ]).status,
    ).toBe("insufficient_evidence"));
});
