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

  it("does not carry a consent forward from an earlier disclosed scope", () => {
    // The version is a description of what leaves the product, and this is the
    // mechanism that makes changing that description mean something. The
    // previous one said chat history was never sent while the Coach was
    // sending ten turns of it; agreement to that sentence is not agreement to
    // the corrected one.
    expect(hasCurrentAiPersonalizationConsent(true, "2026-09-03-memory-context-v1")).toBe(false);
  });

  it("names the scope it is consent to, rather than a date alone", () => {
    // A bare date says a policy changed; it does not say to what. Anybody
    // reading a stored row later should be able to tell which disclosure the
    // person actually saw.
    expect(AI_PERSONALIZATION_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
  });
});
