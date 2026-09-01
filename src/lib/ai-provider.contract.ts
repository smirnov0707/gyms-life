import { z } from "zod";
import { parseCoachRecommendation, type CoachContext, type CoachRecommendation } from "./ai-coach.contract";

export const AIProviderRequestSchema = z.object({
  requestId: z.string().uuid(),
  schemaVersion: z.literal("1.0"),
  task: z.literal("COACH_RECOMMENDATION"),
  context: z.unknown(),
});

export type AIProviderRequest = z.infer<typeof AIProviderRequestSchema> & { context: CoachContext };

export type AIProviderResponse = {
  requestId: string;
  provider: string;
  model: string;
  recommendation: CoachRecommendation;
};

export interface AIProviderAdapter {
  readonly provider: string;
  readonly model: string;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export function createProviderRequest(requestId: string, context: CoachContext): AIProviderRequest {
  const request = { requestId, schemaVersion: "1.0" as const, task: "COACH_RECOMMENDATION" as const, context };
  AIProviderRequestSchema.parse(request);
  return request;
}

export function validateProviderResponse(response: AIProviderResponse): AIProviderResponse {
  return { ...response, recommendation: parseCoachRecommendation(response.recommendation) };
}
