import {
  parseCoachRecommendation,
  type AICoachWorker,
  type CoachContext,
  type CoachRecommendation,
} from "./ai-coach.contract";
import { governCoachRecommendation } from "./ai-coach-governance.engine";

/** Provider-neutral execution boundary. A concrete LLM adapter plugs in later. */
export async function runCoachWorker(
  worker: AICoachWorker,
  context: CoachContext,
): Promise<CoachRecommendation> {
  const recommendation = parseCoachRecommendation(await worker.generateRecommendation(context));
  const governed = governCoachRecommendation(context, recommendation);
  if (governed.enduranceExecution === "blocked") {
    const protectRecovery =
      context.endurance.adaptation?.action === "recover" ||
      context.endurance.postRun?.nextAction === "protect_recovery" ||
      context.endurance.readiness === "strained";
    return {
      ...recommendation,
      decision: "NO_CHANGE",
      priority: protectRecovery ? "HIGH" : "MEDIUM",
      actions: [{ type: protectRecovery ? "RECOVER" : "KEEP_PLAN", exerciseSlug: null, value: null, unit: null, instruction: "Follow the validated GYMS.LIFE endurance decision; the AI-generated override was blocked." }],
      safety: { requiresUserConfirmation: false, notes: [...recommendation.safety.notes, ...governed.violations].slice(0, 6) },
    };
  }
  return recommendation;
}
