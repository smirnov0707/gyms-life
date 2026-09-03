import { describe, expect, it } from "vitest";
import {
  AI_PERSONALIZATION_POLICY_VERSION,
  hasCurrentAiPersonalizationConsent,
} from "./ai-personalization-consent.policy";

describe("AI personalization consent policy", () => {
  it("requires a positive consent recorded for the exact current data scope", () => {
    expect(hasCurrentAiPersonalizationConsent(true, AI_PERSONALIZATION_POLICY_VERSION)).toBe(true);
    expect(hasCurrentAiPersonalizationConsent(true, "2026-09-02")).toBe(false);
    expect(hasCurrentAiPersonalizationConsent(false, AI_PERSONALIZATION_POLICY_VERSION)).toBe(
      false,
    );
    expect(hasCurrentAiPersonalizationConsent(true, null)).toBe(false);
  });
});
