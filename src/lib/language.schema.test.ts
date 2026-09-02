import { describe, expect, it } from "vitest";
import { LANGUAGE_NAMES, parseSupportedLanguage, SupportedLanguageSchema } from "./language.schema";

describe("supported language contract", () => {
  it("accepts every application language and gives AI an explicit language name", () => {
    for (const language of SupportedLanguageSchema.options) {
      expect(parseSupportedLanguage(language)).toBe(language);
      expect(LANGUAGE_NAMES[language]).toMatch(/^[A-Z]/);
    }
  });

  it("does not pass arbitrary client locale values into AI prompts", () => {
    expect(parseSupportedLanguage("pt")).toBeNull();
    expect(parseSupportedLanguage("lt-LT")).toBeNull();
    expect(parseSupportedLanguage(undefined)).toBeNull();
  });
});
