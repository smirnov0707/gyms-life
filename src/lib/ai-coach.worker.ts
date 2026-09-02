import {
  parseCoachRecommendation,
  type AICoachWorker,
  type CoachContext,
  type CoachRecommendation,
} from "./ai-coach.contract";

/** Provider-neutral execution boundary. A concrete LLM adapter plugs in later. */
export async function runCoachWorker(
  worker: AICoachWorker,
  context: CoachContext,
): Promise<CoachRecommendation> {
  const recommendation = await worker.generateRecommendation(context);
  return parseCoachRecommendation(recommendation);
}
