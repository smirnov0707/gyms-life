import { afterEach, describe, expect, it } from "vitest";
import { createAiModel } from "./ai-gateway.server";

const originalGeminiKey = process.env["GEMINI_API_KEY"];
const originalGroqKey = process.env["GROQ_API_KEY"];

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env["GEMINI_API_KEY"];
  else process.env["GEMINI_API_KEY"] = originalGeminiKey;
  if (originalGroqKey === undefined) delete process.env["GROQ_API_KEY"];
  else process.env["GROQ_API_KEY"] = originalGroqKey;
});

describe("AI provider adapter", () => {
  it("returns an actual SDK language model for a configured training-plan worker", () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    const model = createAiModel("google/gemini-2.5-flash", false);

    expect(model).not.toBeNull();
    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("uses the supported Groq replacement for orchestrated text tasks", () => {
    process.env["GROQ_API_KEY"] = "test-key";

    const model = createAiModel("groq/openai/gpt-oss-120b", false);

    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("openai/gpt-oss-120b");
  });
});
