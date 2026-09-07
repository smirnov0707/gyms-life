import { describe, expect, it } from "vitest";
import { HEALTH_INGEST_FIELDS, healthPayloadExample } from "./health-fields";
import { normalizeHealthPayload, type NormalizedHealth } from "./health-normalize";

/**
 * The setup screen tells an athlete which fields to send. This is what stops
 * that from being a claim: every documented name is sent through the
 * normalizer, and the value has to come out the other side.
 *
 * An athlete cannot tell a field that was silently rejected from one they
 * never sent — both are an empty panel — so a stale reference costs them
 * nights of data before anybody notices.
 */

/** Where each documented field is expected to land. */
const READERS: Record<string, (health: NormalizedHealth) => number | null> = {
  sleep_hours: (h) => h.sleepHours,
  sleep_deep_minutes: (h) => h.sleepStages.deepMinutes,
  sleep_rem_minutes: (h) => h.sleepStages.remMinutes,
  sleep_core_minutes: (h) => h.sleepStages.coreMinutes,
  sleep_awake_minutes: (h) => h.sleepStages.awakeMinutes,
  sleep_quality: (h) => h.sleepQuality,
  hrv_ms: (h) => h.hrvMs,
  resting_hr: (h) => h.restingHr,
  steps: (h) => h.steps,
  active_kcal: (h) => h.activeKcal,
  vo2max: (h) => h.vo2max,
};

describe("the documented health fields", () => {
  it("every documented field is actually read, and lands where it says", () => {
    for (const field of HEALTH_INGEST_FIELDS) {
      const reader = READERS[field.key];
      // A field added to the reference without being added here would
      // otherwise be documented and never checked.
      expect(reader, `no reader for documented field ${field.key}`).toBeDefined();
      if (!reader) continue;
      const health = normalizeHealthPayload({ [field.key]: field.example });
      expect(reader(health), `${field.key} did not survive normalization`).toBe(field.example);
    }
  });

  it("the whole example payload survives being sent at once", () => {
    // Sent one at a time above; sent together here, because the stage
    // cross-check only fires when a duration and stages arrive in the same
    // payload — and the example must not be a payload we would refuse.
    const payload = Object.fromEntries(
      HEALTH_INGEST_FIELDS.map((field) => [field.key, field.example]),
    );
    const health = normalizeHealthPayload(payload);
    expect(health.sleepStagesRejected).toBe(false);
    expect(health.sleepStages.deepMinutes).toBe(82);
    expect(health.restingHr).toBe(52);
  });

  it("the example payload is valid JSON containing every documented field", () => {
    const parsed = JSON.parse(healthPayloadExample().replace('"…"', '"token"')) as Record<
      string,
      unknown
    >;
    expect(parsed["token"]).toBe("token");
    // The date is shown because an automation running in the morning is
    // usually reporting the night before.
    expect(parsed["date"]).toBe("2026-09-06");
    for (const field of HEALTH_INGEST_FIELDS) {
      expect(parsed[field.key], `${field.key} missing from the example`).toBe(field.example);
    }
  });
});
