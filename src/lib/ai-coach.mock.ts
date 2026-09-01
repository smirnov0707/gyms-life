import type { AICoachWorker } from "./ai-coach.contract";
import { parseCoachRecommendation } from "./ai-coach.contract";

export const mockCoachWorker: AICoachWorker = {
  name: "mock-coach",
  version: "1.0",
  async generateRecommendation(context) {
    const fatigue = context.insights.some((item) => item.signal === "FATIGUE_RISK");
    if (fatigue) return parseCoachRecommendation({ schemaVersion: "1.0", decision: "ADJUST_NEXT_WORKOUT", priority: "HIGH", summary: "Prioritize recovery before increasing load.", rationale: ["A fatigue-risk signal is present in recent training data."], actions: [{ type: "RECOVER", exerciseSlug: null, value: null, unit: null, instruction: "Keep the next session conservative and prioritize recovery." }], confidence: 0.9, safety: { requiresUserConfirmation: true, notes: ["This is a mock recommendation for testing only."] } });
    return parseCoachRecommendation({ schemaVersion: "1.0", decision: "NO_CHANGE", priority: "LOW", summary: "Continue the current plan.", rationale: [context.performance.workouts > 0 ? "Recent completed workouts are available." : "There is not enough training history for a change."], actions: [{ type: "KEEP_PLAN", exerciseSlug: null, value: null, unit: null, instruction: "Continue the current plan and log the next session." }], confidence: context.performance.workouts > 0 ? 0.75 : 0.4, safety: { requiresUserConfirmation: true, notes: ["This is a mock recommendation for testing only."] } });
  },
};
