import { describe, expect, it } from "vitest";
import { UserMemoryTransparencyItemResultSchema } from "./user-memory.schema";
import { displayedMemoryContent, memoryEvidenceSummary } from "./user-memory.presentation";

const calculatedMemory = UserMemoryTransparencyItemResultSchema.parse({
  id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
  type: "training_pattern",
  content: "Completed 10 workouts in the last 28 days.",
  source: "calculated",
  evidenceState: "calculated_threshold_met",
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
      "Baigtos treniruotės per pastarąsias 28 dienas: 10.",
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
      evidenceState: "user_confirmed",
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
  it("localizes decimal values and uses app-owned English for supplemental locales", () => {
    const recovery = UserMemoryTransparencyItemResultSchema.parse({
      ...calculatedMemory,
      type: "recovery_pattern",
      content: "UNTRUSTED STORED PROSE",
      calculatedValue: {
        kind: "recovery_low_7d",
        averageReadiness: 52.5,
        checkinsLast7Days: 4,
        windowDays: 7,
      },
    });
    expect(displayedMemoryContent(recovery, "lt")).toContain("52,5/100");
    expect(memoryEvidenceSummary(recovery, "lt")).toBe(
      "Įrodymai: pasiruošimo patikrų per 7 dienas — 4.",
    );
    for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
      expect(displayedMemoryContent(recovery, lang)).toBe(
        "Your average readiness was 52.5/100 in the last 7 days.",
      );
      expect(memoryEvidenceSummary(recovery, lang)).toContain("4 readiness check-ins");
    }
    const weight = UserMemoryTransparencyItemResultSchema.parse({
      ...calculatedMemory,
      type: "pattern",
      calculatedValue: {
        kind: "weight_change_30d",
        weightChangeKg: -1.5,
        measurementsLast30Days: 3,
        windowDays: 30,
      },
    });
    expect(displayedMemoryContent(weight, "lt")).toContain("−1,5 kg");
    expect(displayedMemoryContent(weight, "en")).toContain("-1.5 kg");
  });
});
