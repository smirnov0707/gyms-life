import type { AIProviderAdapter, AIProviderResponse } from "./ai-provider.contract";
import type { CoachContext } from "./ai-coach.contract";
import { runCoachWorker } from "./ai-coach.worker";

/** Stable orchestration facade. Provider selection stays outside the domain contract. */
export async function requestCoachRecommendation(args: {
  context: CoachContext;
  provider: AIProviderAdapter;
}): Promise<AIProviderResponse> {
  return runCoachWorker(args.provider, args.context);
}
