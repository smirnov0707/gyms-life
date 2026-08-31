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
 * GYMS.LIFE orchestratorius valdo routingą ir politiką; AI provideriai yra
 * keičiami workeriai. Providerio pasirinkimas niekada neįvyksta šiame facade.
 */
export function createAiRouterProvider(sourceModule = "general") {
  void sourceModule;

  return (modelName: string) => ({
    modelName,
    generate: (messages: AiMessage[]) =>
      generateAiResponse({ messages, capability: "text" }),
  });
}

/**
 * Greitasis tekstinis AI per GYMS.LIFE orchestratorių.
 * Structured/JSON užklausos išlaiko ankstesnį jsonMode kontraktą.
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
