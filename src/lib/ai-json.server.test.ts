import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiErrorMessage } from "./ai-error";
import {
  AiUnavailableError,
  isAiModelUnavailable,
  normalizeAiError,
  parseAiJson,
} from "./ai-json.server";

describe("parseAiJson", () => {
  const schema = z.object({
    name: z.string(),
    score: z.number().min(0).max(100),
  });

  it("extracts a fenced JSON object and validates its domain shape", () => {
    expect(
      parseAiJson('Here is the result:\n```json\n{"name":"Squat","score":92}\n```', schema),
    ).toEqual({ name: "Squat", score: 92 });
  });

  it("rejects a JSON response that does not satisfy the domain schema", () => {
    expect(() => parseAiJson('{"name":"Squat","score":140}', schema)).toThrow();
  });
});

describe("normalizeAiError", () => {
  it("normalizes rate-limit provider errors into a stable contract", () => {
    const providerError = Object.assign(new Error("Too many requests"), { status: 429 });
    const error = normalizeAiError(providerError);

    expect(error).toBeInstanceOf(AiUnavailableError);
    if (!(error instanceof AiUnavailableError))
      throw new Error("Expected an AI availability error");
    expect(error.kind).toBe("rate_limit");
  });
});

describe("aiErrorMessage", () => {
  it("does not expose AI SDK internals when a model is unavailable", () => {
    expect(
      aiErrorMessage(
        new Error("Cannot read properties of null (reading 'specificationVersion')"),
        (key) => key,
      ),
    ).toBe("ai.err.unavailable");
  });

  it("normalizes provider model removals into an application-owned code", () => {
    const error = normalizeAiError({
      status: 404,
      message: "The model `removed-model` does not exist or you do not have access to it.",
    });

    expect(error.message).toBe("AI_MODEL_UNAVAILABLE");
    expect(isAiModelUnavailable(error)).toBe(true);
  });

  it("does not expose quota infrastructure failures to the member", () => {
    expect(aiErrorMessage(new Error("AI_QUOTA_UNAVAILABLE"), (key) => key)).toBe(
      "ai.err.unavailable",
    );
  });

  it("uses a safe AI fallback instead of an unknown provider error", () => {
    expect(
      aiErrorMessage(new Error("provider at https://gateway.example failed"), (key) => key),
    ).toBe("ai.err.unavailable");
  });
});
