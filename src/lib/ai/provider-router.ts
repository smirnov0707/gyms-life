import {
  getConfiguredProviders,
  type AiCapability,
  type AiProviderDefinition,
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

async function callProvider(
  provider: AiProviderDefinition,
  request: AiRequest,
): Promise<AiResponse> {
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
      model: provider.model,
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
    throw new Error(`${provider.id} ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.id} returned an empty response.`);

  return { provider: provider.id, model: payload.model ?? provider.model, text };
}

/**
 * Provider routing is owned by GYMS.LIFE. A paid provider can never enter this
 * function because the registry exposes only cost: "free" providers.
 */
export async function generateAiResponse(request: AiRequest): Promise<AiResponse> {
  const providers = getConfiguredProviders(request.capability ?? "text");
  if (!providers.length) {
    throw new Error("No free AI provider is configured for this request.");
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await callProvider(provider, request);
    } catch (error) {
      errors.push(`${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All free AI providers failed. ${errors.join(" | ")}`);
}
