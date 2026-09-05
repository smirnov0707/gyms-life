import { describe, expect, it } from "vitest";
import { TemporalEvidenceRefSchema } from "./intelligence-provenance.schema";

describe("TemporalEvidenceRefSchema", () => {
  it("preserves occurred time separately from recorded time", () => {
    const evidence = TemporalEvidenceRefSchema.parse({
      sourceType: "set_log",
      sourceId: "set-1",
      provenance: "user_reported",
      occurredAt: "2026-09-05T17:00:00+03:00",
      recordedAt: "2026-09-05T17:04:00+03:00",
      timezone: "Europe/Vilnius",
      quality: "available",
    });
    expect(evidence.occurredAt).not.toBe(evidence.recordedAt);
  });

  it("keeps source and record clocks as facts instead of inventing ordering", () => {
    const evidence = TemporalEvidenceRefSchema.parse({
      sourceType: "wearable_sample",
      sourceId: null,
      provenance: "device_reported",
      occurredAt: "2026-09-05T07:00:00+03:00",
      recordedAt: "2026-09-05T06:59:00+03:00",
      timezone: "Europe/Vilnius",
      quality: "available",
    });
    expect(evidence.quality).toBe("available");
  });
});
