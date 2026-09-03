import { describe, expect, it } from "vitest";
import {
  executeAiModelRoute,
  getAiTaskModelRoute,
  getAiTaskPolicy,
} from "./ai-orchestrator.server";

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

  it("uses a centrally-owned compatibility route for critical plan generation", () => {
    expect(getAiTaskModelRoute("training-plan")).toEqual([
      "google/gemini-2.5-flash",
      "google/gemini-3.1-flash-lite",
      "groq/openai/gpt-oss-120b",
    ]);
    expect(getAiTaskModelRoute("food-vision")).toEqual(["google/gemini-2.5-flash"]);
  });

  it("retries only an unavailable provider model with the next approved worker", async () => {
    const executions = [
      { modelId: "google/gemini-2.5-flash" as const },
      { modelId: "google/gemini-3.1-flash-lite" as const },
    ];
    const routed = await executeAiModelRoute(executions, async (execution) => {
      if (execution.modelId === "google/gemini-2.5-flash") {
        throw Object.assign(new Error("model does not exist"), { status: 404 });
      }
      return "validated response";
    });

    expect(routed.result).toBe("validated response");
    expect(routed.execution.modelId).toBe("google/gemini-3.1-flash-lite");
    expect(routed.attemptedModels).toEqual([
      "google/gemini-2.5-flash",
      "google/gemini-3.1-flash-lite",
    ]);
  });
});
