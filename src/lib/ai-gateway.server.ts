import {
  generateAiResponse,
  type AiMessage,
} from "./ai/provider-router";

export function isAiConfigured(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENROUTER_API_KEY,
  );
}

/**
 * Universalus AI gateway.
 *
 * GYMS.LIFE orchestrator owns provider routing and policy; individual AI
 * providers are replaceable workers and never receive user context directly
 * from the application outside this gateway.
 */
export function createAiRouterProvider(sourceModule = "general") {
  return (modelName: string) => {
    void sourceModule;
    return {
      modelName,
      generate: (messages: AiMessage[]) =>
        generateAiResponse({ messages, capability: "text" }),
    };
  };
}

/**
 * Greitasis tekstinis AI per GYMS.LIFE orchestratorių.
 * Provideris parenkamas centralizuotai, o gedimo atveju naudojamas kitas
 * sukonfigūruotas free-tier provideris.
 */
export async function askFastTextAi({
  messages,
  jsonMode = false,
  temperature = 0.2,
}: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  jsonMode?: boolean;
  temperature?: number;
}): Promise<string> {
  const response = await generateAiResponse({
    messages,
    capability: jsonMode ? "structured" : "text",
    jsonMode,
    temperature,
  });

  return response.text;
}
