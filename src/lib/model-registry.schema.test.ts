import { describe, expect, it } from "vitest";
import { IntelligenceModelDescriptorSchema } from "./model-registry.schema";

describe("IntelligenceModelDescriptorSchema", () => {
  it("keeps model identity application-owned and versioned", () => {
    const model = IntelligenceModelDescriptorSchema.parse({
      modelId: "workout-completion-baseline",
      version: "0.1.0",
      type: "statistical",
      status: "shadow",
      targets: ["workout_completion"],
      inputContractVersion: "digital-athlete-1.7",
      outputContractVersion: "prediction-1",
      description: "Baseline model used to test prediction plumbing before production influence.",
    });
    expect(model.status).toBe("shadow");
    expect(model.targets).toEqual(["workout_completion"]);
  });

  it("rejects unknown production states", () => {
    expect(() => IntelligenceModelDescriptorSchema.parse({
      modelId: "x",
      version: "1",
      type: "statistical",
      status: "live",
      targets: [],
      inputContractVersion: "1",
      outputContractVersion: "1",
      description: "invalid status",
    })).toThrow();
  });
});
