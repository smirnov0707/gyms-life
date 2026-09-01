import {
  createProviderRequest,
  validateProviderResponse,
  type AIProviderAdapter,
  type AIProviderResponse,
} from "./ai-provider.contract";
import type { CoachContext } from "./ai-coach.contract";

/** Provider-neutral execution boundary. Concrete LLM adapters implement AIProviderAdapter. */
export async function runCoachWorker(
  provider: AIProviderAdapter,
  context: CoachContext,
): Promise<AIProviderResponse> {
  const request = createProviderRequest(crypto.randomUUID(), context);
  const response = await provider.generate(request);
  if (response.requestId !== request.requestId) {
    throw new Error("AI provider requestId mismatch");
  }
  return validateProviderResponse(response);
}
