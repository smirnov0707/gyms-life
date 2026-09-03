import { describe, expect, it } from "vitest";
import {
  executeAiModelRoute,
  getAiTaskModelRoute,
  getAiTaskPolicy,
} from "./ai-orchestrator.server";

describe("GYMS.LIFE AI task policy", () => {
  it("keeps model selection and context scope in the central orchestrator", () => {
    expect(getAiTaskPolicy("training-plan")).toMatchObject({
      model: "openai/gpt-4o-mini",
      contextScope: "personalized",
    });
    expect(getAiTaskPolicy("food-vision")).toMatchObject({
      model: "google/gemini-2.5-flash",
      contextScope: "personalized",
    });
    expect(getAiTaskPolicy("plan-translation")).toMatchObject({
      contextScope: "none",
    });
  });

  it("uses a centrally-owned compatibility route for critical plan generation", () => {
    expect(getAiTaskModelRoute("training-plan")).toEqual([
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "groq/openai/gpt-oss-120b",
      "google/gemini-3.1-flash-lite",
    ]);
    expect(getAiTaskModelRoute("food-vision")).toEqual(["google/gemini-2.5-flash"]);
  });

  it("retries only an unavailable provider model with the next approved worker", async () => {
    const executions = [
      { modelId: "openai/gpt-4o-mini" as const },
      { modelId: "google/gemini-2.5-flash" as const },
    ];
    const routed = await executeAiModelRoute(executions, async (execution) => {
      if (execution.modelId === "openai/gpt-4o-mini") {
        throw Object.assign(new Error("model does not exist"), { status: 404 });
      }
      return "validated response";
    });

    expect(routed.result).toBe("validated response");
    expect(routed.execution.modelId).toBe("google/gemini-2.5-flash");
    expect(routed.attemptedModels).toEqual(["openai/gpt-4o-mini", "google/gemini-2.5-flash"]);
  });

  it("uses the next worker for a provider credit refusal, but not invalid output", async () => {
    const executions = [
      { modelId: "openai/gpt-4o-mini" as const },
      { modelId: "google/gemini-2.5-flash" as const },
    ];
    const calls: string[] = [];
    const routed = await executeAiModelRoute(executions, async (execution) => {
      calls.push(execution.modelId);
      if (execution.modelId === "openai/gpt-4o-mini") {
        throw Object.assign(new Error("Payment required"), { status: 402 });
      }
      return "validated response";
    });

    expect(routed.execution.modelId).toBe("google/gemini-2.5-flash");
    expect(calls).toEqual(["openai/gpt-4o-mini", "google/gemini-2.5-flash"]);
  });
});
