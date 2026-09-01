import { z } from "zod";
import {
  CoachContextSchema,
  parseCoachRecommendation,
  type CoachContext,
  type CoachRecommendation,
} from "./ai-coach.contract";

export const AIProviderRequestSchema = z.object({
  requestId: z.string().uuid(),
  schemaVersion: z.literal("1.0"),
  task: z.literal("COACH_RECOMMENDATION"),
  context: CoachContextSchema,
});

export type AIProviderRequest = z.infer<typeof AIProviderRequestSchema>;

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
  return AIProviderRequestSchema.parse({
    requestId,
    schemaVersion: "1.0" as const,
    task: "COACH_RECOMMENDATION" as const,
    context,
  });
}

export function validateProviderResponse(response: AIProviderResponse): AIProviderResponse {
  return {
    ...response,
    recommendation: parseCoachRecommendation(response.recommendation),
  };
}
