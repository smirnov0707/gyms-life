import { describe, expect, it } from "vitest";
import { UserMemoryTransparencyItemResultSchema } from "./user-memory.schema";
import { displayedMemoryContent, memoryEvidenceSummary } from "./user-memory.presentation";

const calculatedMemory = UserMemoryTransparencyItemResultSchema.parse({
  id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
  type: "training_pattern",
  content: "Completed 10 workouts in the last 28 days.",
  source: "calculated",
  confidence: 0.85,
  importance: 0.7,
  status: "active",
  calculatedValue: {
    kind: "training_consistency_28d",
    sessionsLast28Days: 10,
    windowDays: 28,
  },
  evidenceCount: 1,
  lastConfirmedAt: "2026-09-03T09:00:00.000Z",
  expiresAt: null,
});

describe("user-memory presentation", () => {
  it("localizes a calculated statement and its evidence from the validated value", () => {
    expect(displayedMemoryContent(calculatedMemory, "lt")).toBe(
      "Per pastarąsias 28 dienas atlikai 10 treniruotes.",
    );
    expect(memoryEvidenceSummary(calculatedMemory, "en")).toBe(
      "Evidence: 10 completed workout records across 28 days.",
    );
  });

  it("keeps user-written content intact and does not invent an evidence explanation", () => {
    const userMemory = UserMemoryTransparencyItemResultSchema.parse({
      ...calculatedMemory,
      content: "I prefer sessions under 45 minutes.",
      source: "user_reported",
      calculatedValue: null,
    });

    expect(displayedMemoryContent(userMemory, "lt")).toBe(userMemory.content);
    expect(memoryEvidenceSummary(userMemory, "lt")).toBeNull();
  });

  it("presents a rhythm observation from its structured value rather than stored prose", () => {
    const rhythmMemory = UserMemoryTransparencyItemResultSchema.parse({
      ...calculatedMemory,
      type: "behavior",
      content: "Untrusted stored wording.",
      calculatedValue: {
        kind: "training_rhythm_observation_28d",
        usualTrainingDaysLast28Days: 12,
        completedUsualTrainingDaysLast28Days: 8,
        completedFlexibleTrainingDaysLast28Days: 2,
        usualDayCompletionRateLast28Days: 0.67,
        windowDays: 28,
      },
    });

    expect(displayedMemoryContent(rhythmMemory, "en")).toBe(
      "You completed workouts on 8 of your 12 usual training days across the previous 28 complete days.",
    );
    expect(memoryEvidenceSummary(rhythmMemory, "lt")).toBe(
      "Įrodymai: 8 baigtos treniruočių dienos sutapo su tavo pasirinktu ritmu per 28 užbaigtas dienas.",
    );
  });
});
