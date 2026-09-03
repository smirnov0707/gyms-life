import { afterEach, describe, expect, it } from "vitest";
import { createAiModel } from "./ai-gateway.server";

const originalGeminiKey = process.env["GEMINI_API_KEY"];
const originalGroqKey = process.env["GROQ_API_KEY"];
const originalOpenAiKey = process.env["OPENAI_API_KEY"];

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env["GEMINI_API_KEY"];
  else process.env["GEMINI_API_KEY"] = originalGeminiKey;
  if (originalGroqKey === undefined) delete process.env["GROQ_API_KEY"];
  else process.env["GROQ_API_KEY"] = originalGroqKey;
  if (originalOpenAiKey === undefined) delete process.env["OPENAI_API_KEY"];
  else process.env["OPENAI_API_KEY"] = originalOpenAiKey;
});

describe("AI provider adapter", () => {
  it("returns an actual SDK language model for a configured training-plan worker", () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    const model = createAiModel("google/gemini-2.5-flash");

    expect(model).not.toBeNull();
    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("uses the supported Groq replacement for orchestrated text tasks", () => {
    process.env["GROQ_API_KEY"] = "test-key";

    const model = createAiModel("groq/openai/gpt-oss-120b");

    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("openai/gpt-oss-120b");
  });

  it("uses OpenAI only when the centrally selected OpenAI worker is configured", () => {
    process.env["OPENAI_API_KEY"] = "test-key";

    const model = createAiModel("openai/gpt-4o-mini");

    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("gpt-4o-mini");
  });
});
