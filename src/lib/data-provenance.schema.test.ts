import { describe, expect, it } from "vitest";
import {
  DataProvenanceSchema,
  isDerivedProvenance,
  isObservedProvenance,
} from "./data-provenance.schema";
import { EvidenceMetricSchema } from "./evidence.schema";

describe("Future Lab provenance contracts", () => {
  it("keeps observations distinct from derived states", () => {
    expect(isObservedProvenance("measured")).toBe(true);
    expect(isObservedProvenance("user_reported")).toBe(true);
    expect(isObservedProvenance("inferred")).toBe(false);
    expect(isDerivedProvenance("calculated")).toBe(true);
    expect(isDerivedProvenance("predicted")).toBe(true);
    expect(isDerivedProvenance("simulated")).toBe(true);
    expect(isDerivedProvenance("measured")).toBe(false);
  });

  it("supports the full canonical provenance vocabulary", () => {
    for (const value of [
      "known",
      "measured",
      "user_reported",
      "device_reported",
      "calculated",
      "inferred",
      "predicted",
      "simulated",
      "unknown",
    ]) {
      expect(DataProvenanceSchema.parse(value)).toBe(value);
    }
  });

  it("does not allow provenance outside the canonical contract", () => {
    expect(() => DataProvenanceSchema.parse("ai_guess")).toThrow();
  });

  it("validates evidence without converting an inference into a measurement", () => {
    const evidence = EvidenceMetricSchema.parse({
      key: "recovery_trend",
      value: 0.12,
      unit: "ratio",
      source: "inferred",
    });
    expect(evidence.source).toBe("inferred");
  });
});
