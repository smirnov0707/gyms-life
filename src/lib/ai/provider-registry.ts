export type AiProviderId = "groq" | "gemini" | "openrouter-free";

export type AiCapability = "text" | "vision" | "structured";

export type AiAccessTier = "free-tier" | "paid";

export interface AiProviderDefinition {
  id: AiProviderId;
  envKey: string;
  baseUrl: string;
  model: string;
  accessTier: AiAccessTier;
  capabilities: AiCapability[];
}

/**
 * GYMS.LIFE owns routing and user context. Providers are replaceable workers.
 * The zero-cost policy means only providers with an explicitly enabled
 * free-tier route may be selected. A provider having a free tier does not
 * imply that every request or model is free.
 */
export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  {
    id: "groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    accessTier: "free-tier",
    capabilities: ["text", "structured"],
  },
  {
    id: "gemini",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash-lite",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
  },
  {
    id: "openrouter-free",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    accessTier: "free-tier",
    capabilities: ["text", "vision", "structured"],
  },
];

export function getProvider(id: AiProviderId): AiProviderDefinition {
  const provider = AI_PROVIDERS.find((item) => item.id === id);
  if (!provider || provider.accessTier !== "free-tier") {
    throw new Error(`AI provider ${id} is not allowed by the GYMS.LIFE zero-cost policy.`);
  }
  return provider;
}

export function getConfiguredProviders(capability: AiCapability = "text") {
  return AI_PROVIDERS.filter(
    (provider) =>
      provider.accessTier === "free-tier" &&
      provider.capabilities.includes(capability) &&
      Boolean(process.env[provider.envKey]),
  );
}
