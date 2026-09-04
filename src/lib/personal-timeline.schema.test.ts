import { describe, expect, it } from "vitest";
import { PersonalTimelineEventInputSchema } from "./personal-timeline.schema";

describe("PersonalTimelineEventInputSchema", () => {
  it("accepts a real workout-completed event", () => {
    const result = PersonalTimelineEventInputSchema.safeParse({
      eventType: "workout_completed",
      occurredAt: "2026-09-04T18:20:50.881Z",
      timeZone: "Europe/Vilnius",
      provenance: "measured",
      sourceSystem: "gymslife",
      sourceTable: "workout_sessions",
      sourceReference: "00000000-0000-4000-8000-000000000000",
      summary: { durationSeconds: 3120, totalVolume: 4200, dayIndex: 2 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an event type outside the canonical, session/day-level set", () => {
    const result = PersonalTimelineEventInputSchema.safeParse({
      eventType: "set_logged",
      occurredAt: "2026-09-04T18:20:50.881Z",
      timeZone: null,
      provenance: "measured",
      sourceSystem: "gymslife",
      sourceTable: "set_logs",
      sourceReference: "1",
      summary: {},
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized provenance label", () => {
    const result = PersonalTimelineEventInputSchema.safeParse({
      eventType: "checkin_recorded",
      occurredAt: "2026-09-04T18:20:50.881Z",
      timeZone: null,
      provenance: "confident",
      sourceSystem: "gymslife",
      sourceTable: "daily_checkins",
      sourceReference: "2026-09-04",
      summary: { readinessScore: 72 },
    });

    expect(result.success).toBe(false);
  });
});
