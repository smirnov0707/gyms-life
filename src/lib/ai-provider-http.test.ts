import { afterEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { createAiModel, type AiModelId } from "./ai-gateway.server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const routes: [AiModelId, string, string][] = [
  ["google/gemini-3.1-flash-lite", "GEMINI_API_KEY", "generativelanguage.googleapis.com"],
  ["groq/openai/gpt-oss-120b", "GROQ_API_KEY", "api.groq.com"],
  ["openai/gpt-4o-mini", "OPENAI_API_KEY", "api.openai.com"],
  ["openrouter/meta-llama/llama-4-scout", "OPENROUTER_API_KEY", "openrouter.ai"],
];
describe("real SDK adapter HTTP contract, entirely mocked transport", () => {
  it.each(routes)(
    "%s uses current configuration rather than a module-import key snapshot",
    async (modelId, env, host) => {
      const calls: { url: string; headers: Headers; body: unknown }[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          calls.push({
            url: String(input),
            headers: new Headers(init?.headers),
            body: JSON.parse(String(init?.body)),
          });
          return modelId.startsWith("google/")
            ? Response.json({
                candidates: [
                  {
                    content: { role: "model", parts: [{ text: "Synthetic answer" }] },
                    finishReason: "STOP",
                  },
                ],
                usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2, totalTokenCount: 4 },
              })
            : Response.json({
                id: "synthetic",
                object: "chat.completion",
                created: 1,
                model: modelId,
                choices: [
                  {
                    index: 0,
                    message: { role: "assistant", content: "Synthetic answer" },
                    finish_reason: "stop",
                  },
                ],
                usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
              });
        }),
      );
      for (const suffix of ["first", "rotated"]) {
        vi.stubEnv(env, "synthetic-key-" + suffix);
        const result = await generateText({
          model: createAiModel(modelId),
          prompt: "Synthetic transport check only",
          maxRetries: 0,
        });
        expect(result.text).toBe("Synthetic answer");
        expect(result.finishReason).toBe("stop");
        const call = calls.at(-1)!;
        expect(new URL(call.url).hostname).toBe(host);
        expect(
          call.headers.get(modelId.startsWith("google/") ? "x-goog-api-key" : "authorization"),
        ).toBe((modelId.startsWith("google/") ? "" : "Bearer ") + "synthetic-key-" + suffix);
      }
      expect(calls).toHaveLength(2);
    },
  );
});
