import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiErrorMessage } from "./ai-error";
import { AiUnavailableError, normalizeAiError, parseAiJson } from "./ai-json.server";

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
});
