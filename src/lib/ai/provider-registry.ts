export type AiProviderId = "groq" | "gemini" | "openrouter-free";

export type AiModelId =
  | "gemini-3.1-flash-lite"
  | "gemini-3.5-flash-lite"
  | "openrouter-free-general"
  | "openrouter-free-vision"
  | "openrouter-free-reasoning";

export type AiCapability = "text" | "vision" | "structured";
export type AiAccessTier = "free-tier" | "paid";

export interface AiModelDefinition {
  id: AiModelId;
  providerId: AiProviderId;
  model: string;
  accessTier: AiAccessTier;
  capabilities: AiCapability[];
  priority: number;
  role: "general" | "vision" | "reasoning";
}

export interface AiProviderDefinition {
  id: AiProviderId;
  envKey: string;
  baseUrl: string;
}

export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  {
    id: "groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "gemini",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    id: "openrouter-free",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
  },
];

/**
 * Strict zero-cost catalog.
 *
 * Gemini 3.1 Flash-Lite is the primary current free-tier worker for text,
 * vision and structured generation. Gemini 3.5 Flash-Lite is the secondary
 * free-tier worker. Paid models are deliberately excluded.
 */
export const AI_MODELS: readonly AiModelDefinition[] = [
  {
    id: "gemini-3.1-flash-lite",
    providerId: "gemini",
    model: "gemini-3.1-flash-lite",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
    priority: 10,
    role: "vision",
  },
  {
    id: "gemini-3.5-flash-lite",
    providerId: "gemini",
    model: "gemini-3.5-flash-lite",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
    priority: 11,
    role: "general",
  },
  {
    id: "openrouter-free-general",
    providerId: "openrouter-free",
    model: "openrouter/free",
    accessTier: "free-tier",
    capabilities: ["text", "structured"],
    priority: 20,
    role: "general",
  },
  {
    id: "openrouter-free-vision",
    providerId: "openrouter-free",
    model: "openrouter/free",
    accessTier: "free-tier",
    capabilities: ["vision", "text", "structured"],
    priority: 20,
    role: "vision",
  },
  {
    id: "openrouter-free-reasoning",
    providerId: "openrouter-free",
    model: "openrouter/free",
    accessTier: "free-tier",
    capabilities: ["text", "structured"],
    priority: 20,
    role: "reasoning",
  },
];

export function getConfiguredModels(capability: AiCapability = "text") {
  return AI_MODELS
    .filter(
      (model) =>
        model.accessTier === "free-tier" &&
        model.capabilities.includes(capability) &&
        Boolean(
          AI_PROVIDERS.find((provider) => provider.id === model.providerId) &&
            process.env[
              AI_PROVIDERS.find((provider) => provider.id === model.providerId)!
                .envKey
            ],
        ),
    )
    .sort((a, b) => a.priority - b.priority);
}

export function getProvider(id: AiProviderId): AiProviderDefinition {
  const provider = AI_PROVIDERS.find((item) => item.id === id);
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}
