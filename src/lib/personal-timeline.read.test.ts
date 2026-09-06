import { describe, expect, it } from "vitest";
import { buildPersonalTimelinePage, PERSONAL_TIMELINE_LIMIT } from "./personal-timeline.read";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    event_type: "workout_completed",
    occurred_at: "2026-09-05T19:00:00+03:00",
    created_at: "2026-09-06T08:00:00Z",
    timezone: "Europe/Vilnius",
    provenance: "measured",
    quality: "unknown",
    source_system: "gymslife",
    source_table: "workout_sessions",
    source_reference: "session-1",
    schema_version: "1.0",
    ...overrides,
  };
}

describe("personal timeline read model", () => {
  it("keeps occurrence and index recording time separate for delayed writes", () => {
    const page = buildPersonalTimelinePage([row()]);
    expect(page.events[0]).toMatchObject({
      occurredAt: "2026-09-05T19:00:00+03:00",
      recordedAt: "2026-09-06T08:00:00Z",
      timeZone: "Europe/Vilnius",
      quality: "unknown",
    });
    expect(page.omittedCount).toBe(0);
  });

  it("sorts by occurrence instant rather than offset text or arrival time", () => {
    const page = buildPersonalTimelinePage([
      row(),
      row({
        id: "00000000-0000-4000-8000-000000000002",
        occurred_at: "2026-09-05T17:00:00Z",
        created_at: "2026-09-05T17:01:00Z",
      }),
    ]);
    expect(page.events[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("breaks equal-instant ties by descending id", () => {
    const page = buildPersonalTimelinePage([
      row(),
      row({ id: "00000000-0000-4000-8000-000000000002" }),
    ]);
    expect(page.events[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("reports empty only for a successful empty result", () => {
    expect(buildPersonalTimelinePage([])).toEqual({
      events: [],
      omittedCount: 0,
      hasMore: false,
      limit: PERSONAL_TIMELINE_LIMIT,
    });
  });

  it.each([null, undefined, {}, "bad response"])("rejects non-array response %s", (value) => {
    expect(() => buildPersonalTimelinePage(value)).toThrow();
  });

  it.each(["not-a-date", "2026-09-05", "2026-09-05T19:00:00"])(
    "counts invalid or ambiguous occurrence time %s instead of fabricating it",
    (occurred_at) => {
      const page = buildPersonalTimelinePage([row({ occurred_at }), row()]);
      expect(page.events).toHaveLength(1);
      expect(page.omittedCount).toBe(1);
    },
  );

  it("does not replace an absent recorded time with now or occurrence time", () => {
    const page = buildPersonalTimelinePage([row({ created_at: null })]);
    expect(page.events).toEqual([]);
    expect(page.omittedCount).toBe(1);
  });

  it("keeps unrecognized event, provenance and quality vocabulary unknown", () => {
    const page = buildPersonalTimelinePage([
      row({ event_type: "future_event", provenance: "omniscient", quality: "perfect" }),
    ]);
    expect(page.events[0]).toMatchObject({ eventType: null, provenance: null, quality: null });
  });

  it.each([null, "Not/AZone", ""])(
    "does not guess a missing or invalid source zone %s",
    (timezone) => {
      expect(buildPersonalTimelinePage([row({ timezone })]).events[0]?.timeZone).toBeNull();
    },
  );

  it("preserves all existing provenance values without upgrading them to measured", () => {
    for (const provenance of [
      "measured",
      "device_reported",
      "user_reported",
      "calculated",
      "inferred",
      "predicted",
      "simulated",
    ]) {
      expect(buildPersonalTimelinePage([row({ provenance })]).events[0]?.provenance).toBe(provenance);
    }
  });

  it("exposes the bounded window without implying complete history", () => {
    const rows = Array.from({ length: PERSONAL_TIMELINE_LIMIT + 1 }, (_, index) =>
      row({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
    );
    const page = buildPersonalTimelinePage(rows);
    expect(page.events).toHaveLength(PERSONAL_TIMELINE_LIMIT);
    expect(page.hasMore).toBe(true);
    expect(page.omittedCount).toBe(0);
    expect(buildPersonalTimelinePage(rows.slice(1)).hasMore).toBe(false);
    expect(() => buildPersonalTimelinePage([...rows, row()])).toThrow();
  });

  it("does not export arbitrary source summaries or ownership fields", () => {
    const page = buildPersonalTimelinePage([row()]);
    expect(page.events[0]).not.toHaveProperty("summary");
    expect(page.events[0]).not.toHaveProperty("user_id");
  });
});
