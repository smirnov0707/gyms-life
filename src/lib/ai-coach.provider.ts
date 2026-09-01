import type { CoachContext, CoachRecommendation, AICoachWorker } from "./ai-coach.contract";
import { parseCoachRecommendation } from "./ai-coach.contract";

export type StructuredCompletion = (input: { system: string; user: string; jsonSchema: unknown }) => Promise<unknown>;

export function createStructuredCoachProvider(complete: StructuredCompletion): AICoachWorker {
  return {
    name: "structured-llm",
    version: "1.0",
    async generateRecommendation(context: CoachContext): Promise<CoachRecommendation> {
      const raw = await complete({
        system: "You are the GYMS.LIFE Coach. Return only a JSON object matching the supplied schema. Do not invent workout facts. Estimated 1RM is derived, not actual lifted weight. Recommendations that change training require user confirmation.",
        user: JSON.stringify(context),
        jsonSchema: "CoachRecommendationSchema:v1",
      });
      return parseCoachRecommendation(raw);
    },
  };
}
