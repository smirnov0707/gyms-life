import { describe, expect, it } from "vitest";
import { TwinRegionStateSchema } from "./digital-twin.schema";

describe("TwinRegionStateSchema", () => {
  it("accepts a calculated region with a real recovery value", () => {
    const result = TwinRegionStateSchema.safeParse({
      region: "chest",
      provenance: "calculated",
      recoveryPct: 62,
      recoveryBand: "moderate",
      volumeKg: 400,
      lastTrainedHoursAgo: 12,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an unknown region with every value null", () => {
    const result = TwinRegionStateSchema.safeParse({
      region: "legs",
      provenance: "unknown",
      recoveryPct: null,
      recoveryBand: "unknown",
      volumeKg: null,
      lastTrainedHoursAgo: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a calculated region with no recovery value", () => {
    const result = TwinRegionStateSchema.safeParse({
      region: "chest",
      provenance: "calculated",
      recoveryPct: null,
      recoveryBand: "unknown",
      volumeKg: null,
      lastTrainedHoursAgo: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown region that smuggles in a fabricated recovery value", () => {
    const result = TwinRegionStateSchema.safeParse({
      region: "chest",
      provenance: "unknown",
      recoveryPct: 100,
      recoveryBand: "fresh",
      volumeKg: null,
      lastTrainedHoursAgo: null,
    });
    expect(result.success).toBe(false);
  });
});
