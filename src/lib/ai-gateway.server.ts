import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { reserveAiRequest } from "./ai-quota.server";

const groqClient = createGroq({
  apiKey: process.env["GROQ_API_KEY"] ?? "",
});

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env["GEMINI_API_KEY"] ?? "",
});

const GeminiTextResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).min(1),
          })
          .optional(),
      }),
    )
    .default([]),
});

const GroqChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .min(1),
});

function extractGeminiText(payload: unknown): string {
  const response = GeminiTextResponseSchema.safeParse(payload);
  if (!response.success) return "";
  return (
    response.data.candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .find((text): text is string => Boolean(text?.trim())) ?? ""
  );
}

export function isAiConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"]);
}

/**
 * Universalus AI modelių parinkiklis
 */
export function createAiRouterProvider(_sourceModule = "general") {
  return (modelName: string) => {
    if (modelName.includes("gemini") && process.env["GEMINI_API_KEY"]) {
      const cleanName = modelName.replace("google/", "");
      return googleClient(cleanName);
    }
    if (!process.env["GROQ_API_KEY"]) {
      throw new Error("AI is not configured for the requested model.");
    }
    return groqClient("llama-3.3-70b-versatile");
  };
}

/**
 * Greitasis teksto AI modelis (Groq LPU <200ms)
 */
export async function askFastTextAi({
  userId,
  messages,
  jsonMode = false,
  temperature = 0.2,
}: {
  userId: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  jsonMode?: boolean;
  temperature?: number;
}): Promise<string> {
  await reserveAiRequest(userId);

  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) {
    // Atsarginis variantas per Gemini, jei nėra Groq rakto
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) throw new Error("Nėra sukonfigūruotas nei GROQ_API_KEY, nei GEMINI_API_KEY");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const promptText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: jsonMode
          ? { responseMimeType: "application/json", temperature }
          : { temperature },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API klaida: ${body.slice(0, 500)}`);
    }
    return extractGeminiText(await res.json());
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API klaida: ${err}`);
  }

  const json = GroqChatResponseSchema.safeParse(await res.json());
  if (!json.success) throw new Error("Groq API returned an invalid response.");
  return json.data.choices[0]?.message.content ?? "";
}
