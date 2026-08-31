import {
  getConfiguredModels,
  getProvider,
  type AiCapability,
  type AiModelDefinition,
} from "./provider-registry";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface AiRequest {
  messages: AiMessage[];
  capability?: AiCapability;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface AiResponse {
  provider: string;
  model: string;
  text: string;
}

async function callModel(
  model: AiModelDefinition,
  request: AiRequest,
): Promise<AiResponse> {
  if (model.accessTier !== "free-tier") {
    throw new Error(`Blocked paid AI model: ${model.id}`);
  }

  const provider = getProvider(model.providerId);
  const apiKey = process.env[provider.envKey];
  if (!apiKey) throw new Error(`${provider.envKey} is not configured.`);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider.id === "openrouter-free"
        ? {
            "HTTP-Referer": "https://gyms.life",
            "X-Title": "GYMS.LIFE",
          }
        : {}),
    },
    body: JSON.stringify({
      model: model.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 1200,
      ...(request.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${model.id} ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${model.id} returned an empty response.`);

  return {
    provider: provider.id,
    model: payload.model ?? model.model,
    text,
  };
}

/**
 * GYMS.LIFE is the orchestrator. Models are replaceable workers.
 * Only explicitly configured free-tier models may be selected.
 */
export async function generateAiResponse(request: AiRequest): Promise<AiResponse> {
  const models = getConfiguredModels(request.capability ?? "text");
  if (!models.length) {
    throw new Error("No free AI model is configured for this request.");
  }

  const errors: string[] = [];
  for (const model of models) {
    try {
      return await callModel(model, request);
    } catch (error) {
      errors.push(`${model.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All free AI models failed. ${errors.join(" | ")}`);
}
