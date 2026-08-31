/**
 * GYMS.LIFE Hybrid AI Engine Orchestrator
 * Groq LPU (GPT-OSS 120B / Compound) + Google Gemini Vision Flash
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequestOptions {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export const getActiveAiConfig = () => {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  return {
    hasGroq: Boolean(groqKey && groqKey.startsWith("gsk_")),
    hasGemini: Boolean(geminiKey && geminiKey.length > 10),
    groqKey,
    geminiKey,
  };
};

export const isAiConfigured = (): boolean => {
  const { hasGroq, hasGemini } = getActiveAiConfig();
  return hasGroq || hasGemini;
};

export async function askFastTextAi(options: AiRequestOptions): Promise<string> {
  const { groqKey, geminiKey } = getActiveAiConfig();

  // 1. Prioritetas: Groq GPT-OSS 120B / Compound Mini (momentinis atsakas)
  if (groqKey) {
    const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "groq/compound-mini"];
    for (const model of models) {
      try {
        const body: any = {
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 1024,
        };
        if (options.jsonMode) {
          body.response_format = { type: "json_object" };
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch (err) {
        console.warn(`Groq ${model} failover:`, err);
      }
    }
  }

  // 2. Fallback: Google Gemini 2.5 Flash / 2.0 Flash
  if (geminiKey) {
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
    const prompt = options.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    for (const gModel of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: options.temperature ?? 0.3,
                responseMimeType: options.jsonMode ? "application/json" : "text/plain",
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }
      } catch (err) {
        console.warn(`Gemini ${gModel} failover:`, err);
      }
    }
  }

  throw new Error("AI paslauga šiuo metu nepasiekiama. Patikrinkite API raktus.");
}
