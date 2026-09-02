import { afterEach, describe, expect, it } from "vitest";
import { createAiModel } from "./ai-gateway.server";

const originalGeminiKey = process.env["GEMINI_API_KEY"];

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env["GEMINI_API_KEY"];
  else process.env["GEMINI_API_KEY"] = originalGeminiKey;
});

describe("AI provider adapter", () => {
  it("returns an actual SDK language model for a configured training-plan worker", () => {
    process.env["GEMINI_API_KEY"] = "test-key";

    const model = createAiModel("google/gemini-2.5-flash", false);

    expect(model).not.toBeNull();
    expect(model.specificationVersion).toBe("v4");
    expect(model.modelId).toBe("gemini-2.5-flash");
  });
});
