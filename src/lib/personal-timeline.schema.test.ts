import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PersonalTimelineEventInputSchema,
  PersonalTimelineEventTypeSchema,
  TIMELINE_AUDIT_EVENT_TYPES,
} from "./personal-timeline.schema";

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

  it("accepts hypothesis transitions for the server-owned audit index only", () => {
    const input = PersonalTimelineEventInputSchema.safeParse({
      eventType: "hypothesis_transition",
      occurredAt: "2026-09-04T18:20:50.881Z",
      timeZone: "Europe/Vilnius",
      provenance: "calculated",
      sourceSystem: "gymslife",
      sourceTable: "athlete_hypothesis",
      sourceReference: "athlete-hypothesis:test:123",
      summary: { hypothesisId: "test", status: "monitoring" },
    });

    expect(input.success).toBe(true);
    expect(PersonalTimelineEventTypeSchema.safeParse("hypothesis_transition").success).toBe(false);
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

  it.each(["known", "unknown", "confident"])("rejects %s as provenance", (provenance) => {
    const result = PersonalTimelineEventInputSchema.safeParse({
      eventType: "checkin_recorded",
      occurredAt: "2026-09-04T18:20:50.881Z",
      timeZone: null,
      provenance,
      sourceSystem: "gymslife",
      sourceTable: "daily_checkins",
      sourceReference: "2026-09-04",
      summary: { readinessScore: 72 },
    });

    expect(result.success).toBe(false);
  });

  it("accepts a nightly recalculation as an audit record and not as a user event", () => {
    const input = PersonalTimelineEventInputSchema.safeParse({
      eventType: "twin_recalculated",
      occurredAt: "2026-09-08T03:10:00.000Z",
      timeZone: "Europe/Vilnius",
      provenance: "calculated",
      sourceSystem: "gymslife",
      sourceTable: "background_job_runs",
      sourceReference: "2026-09-08",
      summary: { job: "night_lab" },
    });

    expect(input.success).toBe(true);
    // A background job looking at somebody is not an event in their life.
    expect(PersonalTimelineEventTypeSchema.safeParse("twin_recalculated").success).toBe(false);
  });

  it("requires an offset-aware occurrence time", () => {
    const result = PersonalTimelineEventInputSchema.safeParse({
      eventType: "decision_recorded",
      occurredAt: "2026-09-04 18:20:50",
      timeZone: "Europe/Vilnius",
      provenance: "calculated",
      sourceSystem: "gymslife",
      sourceTable: "decision_records",
      sourceReference: "00000000-0000-4000-8000-000000000001",
      summary: {},
    });

    expect(result.success).toBe(false);
  });
});

/**
 * The audit types and the user-visible ones share one table, so every generic
 * reader has to exclude the audit ones. Each of the three that existed did it
 * by hand — `.neq("event_type", "hypothesis_transition")` — which was correct
 * only for as long as there was exactly one audit type. Adding the second
 * would have leaked a background job into the athlete's timeline, the Twin's
 * evidence window and the decision evidence behind them, as something they did.
 */
describe("the audit types the timeline must not show", () => {
  it("shares no name with the events the athlete actually produced", () => {
    for (const audit of TIMELINE_AUDIT_EVENT_TYPES) {
      expect(PersonalTimelineEventTypeSchema.options).not.toContain(audit);
    }
  });

  it("is never filtered by a hand-written literal", () => {
    // The regression guard. A reader that names one audit type is a reader
    // that will be wrong the next time one is added.
    const SRC = path.resolve("src");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
      });

    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      // The schema itself is where the names are allowed to be written down.
      if (relative === "lib/personal-timeline.schema.ts") continue;
      const source = readFileSync(file, "utf8");
      for (const audit of TIMELINE_AUDIT_EVENT_TYPES) {
        // Only exclusions. A reader that selects one audit type with `.eq` is
        // doing the opposite of leaking it — that is the Lab ledger reading
        // its own records, and it is meant to name the one it wants. A writer
        // naming its own type is fine for the same reason.
        const excludes = new RegExp(`\\.(?:neq|not)\\([^)]*"${audit}"`);
        if (excludes.test(source)) offenders.push(`${relative}: ${audit}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
