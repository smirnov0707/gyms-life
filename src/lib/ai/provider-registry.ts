export type AiProviderId = "groq" | "gemini" | "openrouter-free";

export type AiCapability = "text" | "vision" | "structured";

export interface AiProviderDefinition {
  id: AiProviderId;
  envKey: string;
  baseUrl: string;
  model: string;
  cost: "free";
  capabilities: AiCapability[];
}

/**
 * GYMS.LIFE owns routing and user context. Providers are replaceable workers.
 * Only providers explicitly marked free can be selected by the router.
 */
export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  {
    id: "groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    cost: "free",
    capabilities: ["text", "structured"],
  },
  {
    id: "gemini",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash-lite",
    cost: "free",
    capabilities: ["text", "vision", "structured"],
  },
  {
    id: "openrouter-free",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    cost: "free",
    capabilities: ["text", "vision", "structured"],
  },
];

export function getProvider(id: AiProviderId): AiProviderDefinition {
  const provider = AI_PROVIDERS.find((item) => item.id === id);
  if (!provider || provider.cost !== "free") {
    throw new Error(`AI provider ${id} is not allowed by the GYMS.LIFE zero-cost policy.`);
  }
  return provider;
}

export function getConfiguredProviders(capability: AiCapability = "text") {
  return AI_PROVIDERS.filter(
    (provider) =>
      provider.cost === "free" &&
      provider.capabilities.includes(capability) &&
      Boolean(process.env[provider.envKey]),
  );
}
