import { describe, expect, it } from "vitest";
import {
  buildTwinEvidenceWindow,
  normalizeTwinEvidenceWindowInput,
} from "./twin-evidence-window";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    event_type: "workout_completed",
    occurred_at: "2026-09-06T09:30:00Z",
    created_at: "2026-09-06T09:31:00Z",
    timezone: "Europe/Vilnius",
    provenance: "calculated",
    quality: "unknown",
    source_system: "gymslife",
    source_table: "workout_sessions",
    source_reference: "session-1",
    schema_version: "1.0",
    ...overrides,
  };
}

const interval = {
  olderAt: "2026-09-06T09:00:00.000Z",
  newerAt: "2026-09-06T10:00:00.000Z",
};

describe("Twin evidence interval", () => {
  it("normalizes timestamp offsets to canonical UTC instants", () => {
    expect(
      normalizeTwinEvidenceWindowInput({
        olderAt: "2026-09-06T12:00:00+03:00",
        newerAt: "2026-09-06T13:00:00+03:00",
      }),
    ).toEqual(interval);
  });

  it("rejects equal or reversed state boundaries", () => {
    expect(() =>
      normalizeTwinEvidenceWindowInput({
        olderAt: "2026-09-06T10:00:00Z",
        newerAt: "2026-09-06T10:00:00Z",
      }),
    ).toThrow();
    expect(() =>
      normalizeTwinEvidenceWindowInput({
        olderAt: "2026-09-06T11:00:00Z",
        newerAt: "2026-09-06T10:00:00Z",
      }),
    ).toThrow();
  });

  it("uses the half-open interval (older, newer]", () => {
    const result = buildTwinEvidenceWindow(interval, [
      row({ occurred_at: interval.newerAt }),
      row({
        id: "00000000-0000-4000-8000-000000000002",
        occurred_at: interval.olderAt,
      }),
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.occurredAt).toBe(interval.newerAt);
    expect(result.omittedCount).toBe(1);
  });

  it("does not fabricate evidence from a successful empty interval", () => {
    expect(buildTwinEvidenceWindow(interval, [])).toMatchObject({
      events: [],
      omittedCount: 0,
      hasMore: false,
    });
  });

  it("preserves Timeline provenance instead of upgrading it", () => {
    const result = buildTwinEvidenceWindow(interval, [row({ provenance: "user_reported" })]);
    expect(result.events[0]?.provenance).toBe("user_reported");
  });

  it("rejects malformed transport responses rather than treating them as no evidence", () => {
    expect(() => buildTwinEvidenceWindow(interval, null)).toThrow();
    expect(() => buildTwinEvidenceWindow(interval, { unexpected: true })).toThrow();
  });
});
