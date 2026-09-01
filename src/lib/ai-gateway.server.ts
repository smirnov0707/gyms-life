import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const groqClient = createGroq({ apiKey: process.env["GROQ_API_KEY"] || "" });
const googleClient = createGoogleGenerativeAI({ apiKey: process.env["GEMINI_API_KEY"] || "" });

export function isAiConfigured(): boolean {
  return Boolean(process.env["GROQ_API_KEY"] || process.env["GEMINI_API_KEY"]);
}

export function createAiRouterProvider(sourceModule = "general") {
  void sourceModule;
  return (modelName: string) => {
    if (modelName.includes("gemini") && process.env["GEMINI_API_KEY"]) {
      return googleClient(modelName.replace("google/", ""));
    }
    return groqClient("llama-3.3-70b-versatile");
  };
}

export async function askFastTextAi({
  messages,
  jsonMode = false,
  temperature = 0.2,
}: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  jsonMode?: boolean;
  temperature?: number;
}): Promise<string> {
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) throw new Error("Nėra sukonfigūruotas nei GROQ_API_KEY, nei GEMINI_API_KEY");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const promptText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: jsonMode ? { responseMimeType: "application/json", temperature } : { temperature },
      }),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Groq API klaida: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}
