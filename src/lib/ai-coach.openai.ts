import {
  CoachContextSchema,
  parseCoachRecommendation,
  type CoachContext,
  type CoachRecommendation,
} from "./ai-coach.contract";
import type { AIProviderAdapter, AIProviderRequest, AIProviderResponse } from "./ai-provider.contract";

const SYSTEM_PROMPT = `You are the GYMS.LIFE AI Coach worker. Interpret only the supplied structured context. Do not invent user data. Return exactly one JSON object matching the requested recommendation schema. Estimated 1RM is derived, not actual lifted weight. Recommendations must be conservative and require user confirmation for changes.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "decision", "priority", "summary", "rationale", "actions", "confidence", "safety"],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    decision: { type: "string", enum: ["NO_CHANGE", "ADJUST_NEXT_WORKOUT", "ADJUST_PROGRAM"] },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string" },
    rationale: { type: "array", items: { type: "string" }, maxItems: 8 },
    actions: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "exerciseSlug", "value", "unit", "instruction"],
        properties: {
          type: { type: "string", enum: ["INCREASE_LOAD", "DECREASE_LOAD", "CHANGE_REPS", "CHANGE_SETS", "CHANGE_REST", "KEEP_PLAN", "RECOVER"] },
          exerciseSlug: { type: ["string", "null"] },
          value: { type: ["number", "null"] },
          unit: { type: ["string", "null"], enum: ["kg", "reps", "sets", "seconds", "percent", null] },
          instruction: { type: "string" },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    safety: {
      type: "object",
      additionalProperties: false,
      required: ["requiresUserConfirmation", "notes"],
      properties: {
        requiresUserConfirmation: { type: "boolean" },
        notes: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
    },
  },
} as const;

export class OpenAICoachWorker implements AIProviderAdapter {
  readonly provider = "openai";
  readonly model: string;
  private readonly apiKey: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = options?.model ?? process.env.OPENAI_COACH_MODEL ?? "gpt-5.6-luna";
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    const safeContext: CoachContext = CoachContextSchema.parse(request.context);
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(safeContext) }] },
        ],
        text: { format: { type: "json_schema", name: "coach_recommendation", strict: true, schema: RESPONSE_SCHEMA } },
      }),
    });

    if (!response.ok) throw new Error(`OpenAI Coach request failed (${response.status})`);
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) throw new Error("AI Coach returned an empty response");

    const recommendation: CoachRecommendation = parseCoachRecommendation(JSON.parse(payload.output_text));
    return { requestId: request.requestId, provider: this.provider, model: this.model, recommendation };
  }
}
