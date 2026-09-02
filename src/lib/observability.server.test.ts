import { describe, expect, it } from "vitest";
import { ObservabilityEventInputSchema } from "./observability.server";

describe("ObservabilityEventInputSchema", () => {
  it("accepts bounded operational metadata", () => {
    const result = ObservabilityEventInputSchema.safeParse({
      eventName: "ai.request",
      outcome: "success",
      userId: "00000000-0000-4000-8000-000000000000",
      durationMs: 128,
      metadata: { model: "google/gemini-2.5-flash", request_count: 1 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects nested or oversized metadata that could contain private payloads", () => {
    const result = ObservabilityEventInputSchema.safeParse({
      eventName: "ai.request",
      outcome: "failure",
      userId: "00000000-0000-4000-8000-000000000000",
      metadata: { prompt: { text: "private" } },
    });

    expect(result.success).toBe(false);
  });

  it("rejects arbitrary error text in favor of stable error codes", () => {
    const result = ObservabilityEventInputSchema.safeParse({
      eventName: "training_plan.generation",
      outcome: "failure",
      userId: "00000000-0000-4000-8000-000000000000",
      errorCode: "Plan save error: relation missing",
    });

    expect(result.success).toBe(false);
  });
});
