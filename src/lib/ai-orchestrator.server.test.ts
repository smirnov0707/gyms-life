import { describe, expect, it } from "vitest";
import { getAiTaskPolicy } from "./ai-orchestrator.server";

describe("GYMS.LIFE AI task policy", () => {
  it("keeps model selection and context scope in the central orchestrator", () => {
    expect(getAiTaskPolicy("training-plan")).toMatchObject({
      model: "google/gemini-2.5-flash",
      contextScope: "personalized",
    });
    expect(getAiTaskPolicy("food-vision")).toMatchObject({
      model: "google/gemini-2.5-flash",
      contextScope: "personalized",
      allowProviderFallback: false,
    });
    expect(getAiTaskPolicy("plan-translation")).toMatchObject({
      contextScope: "none",
    });
  });
});
