export type AiProviderId = "groq" | "gemini" | "openrouter-free";

export type AiModelId =
  | "gpt-oss-120b"
  | "gemini-2.5-flash-lite"
  | "openrouter-free";

export type AiCapability = "text" | "vision" | "structured";
export type AiAccessTier = "free-tier" | "paid";

export interface AiModelDefinition {
  id: AiModelId;
  providerId: AiProviderId;
  model: string;
  accessTier: AiAccessTier;
  capabilities: AiCapability[];
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

export const AI_MODELS: readonly AiModelDefinition[] = [
  {
    id: "gpt-oss-120b",
    providerId: "groq",
    model: "openai/gpt-oss-120b",
    accessTier: "free-tier",
    capabilities: ["text", "structured"],
  },
  {
    id: "gemini-2.5-flash-lite",
    providerId: "gemini",
    model: "gemini-2.5-flash-lite",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
  },
  {
    id: "openrouter-free",
    providerId: "openrouter-free",
    model: "openrouter/free",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
  },
];

export function getConfiguredModels(capability: AiCapability = "text") {
  return AI_MODELS.filter(
    (model) =>
      model.accessTier === "free-tier" &&
      model.capabilities.includes(capability) &&
      Boolean(process.env[AI_PROVIDERS.find((p) => p.id === model.providerId)?.envKey ?? ""]),
  );
}

export function getProvider(id: AiProviderId): AiProviderDefinition {
  const provider = AI_PROVIDERS.find((item) => item.id === id);
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}
