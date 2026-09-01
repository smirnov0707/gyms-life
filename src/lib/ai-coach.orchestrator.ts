import { randomUUID } from "node:crypto";
import { createProviderRequest, validateProviderResponse, type AIProviderAdapter, type AIProviderResponse } from "./ai-provider.contract";
import type { CoachContext } from "./ai-coach.contract";

export async function requestCoachRecommendation(args: { context: CoachContext; provider: AIProviderAdapter }): Promise<AIProviderResponse> {
  const request = createProviderRequest(randomUUID(), args.context);
  const response = await args.provider.generate(request);
  if (response.requestId !== request.requestId) throw new Error("AI provider requestId mismatch");
  return validateProviderResponse(response);
}
