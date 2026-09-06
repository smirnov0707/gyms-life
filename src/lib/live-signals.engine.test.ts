import { describe, expect, it } from "vitest";
import {
  LIVE_SIGNAL_IDS,
  SIGNAL_STALE_AFTER_DAYS,
  buildLiveSignals,
  liveSignalsSummary,
  type BodyMetricRow,
  type HealthSampleRow,
} from "./live-signals.engine";

const health = (
  day: string,
  values: Partial<Omit<HealthSampleRow, "sample_on">> = {},
): HealthSampleRow => ({
  sample_on: day,
  source: "apple_health",
  resting_hr: null,
  hrv_ms: null,
  sleep_hours: null,
  steps: null,
  active_kcal: null,
  ...values,
});

const body = (
  day: string,
  values: Partial<Omit<BodyMetricRow, "measured_on">> = {},
): BodyMetricRow => ({
  measured_on: day,
  weight_kg: null,
  body_fat: null,
  ...values,
});

const today = "2026-09-06";
const signal = (signals: ReturnType<typeof buildLiveSignals>, id: string) => {
  const found = signals.find((entry) => entry.id === id);
  if (!found) throw new Error(`no signal ${id}`);
  return found;
};

describe("live signals", () => {
  it("returns every signal the rail promises, in every case", () => {
    // A missing entry is a hole in the rail; the component would render
    // nothing there and the athlete would read it as "fine".
    const signals = buildLiveSignals({ health: [], body: [], today });
    expect(signals.map((entry) => entry.id)).toEqual([...LIVE_SIGNAL_IDS]);
  });

  it("separates a source that never sent anything from one that could not be read", () => {
    // Both render as an empty tile if you only look at the value. One means
    // "connect your watch", the other means "we could not look" — sending an
    // athlete to set up a watch they already wear is the failure here.
    const never = buildLiveSignals({ health: [], body: [], today });
    expect(signal(never, "hrv").state).toBe("absent");
    const broken = buildLiveSignals({ health: null, body: [], today });
    expect(signal(broken, "hrv").state).toBe("unreadable");
    expect(signal(broken, "weight").state).toBe("absent");
  });

  it("reads a value with its day, its age and its source", () => {
    const signals = buildLiveSignals({
      health: [health(today, { hrv_ms: 68, sleep_hours: "7.68" })],
      body: [],
      today,
    });
    expect(signal(signals, "hrv")).toMatchObject({
      state: "measured",
      value: 68,
      recordedOn: today,
      ageDays: 0,
      source: "apple_health",
    });
    // Postgres numerics arrive as strings over the wire.
    expect(signal(signals, "sleep").value).toBe(7.68);
  });

  it("calls an old reading old instead of passing it off as today's", () => {
    const stale = `2026-08-20`;
    const signals = buildLiveSignals({ health: [health(stale, { steps: 8342 })], body: [], today });
    expect(signal(signals, "steps")).toMatchObject({ state: "stale", value: 8342, ageDays: 17 });

    const edge = buildLiveSignals({
      health: [health("2026-09-03", { steps: 10 })],
      body: [],
      today,
    });
    expect(SIGNAL_STALE_AFTER_DAYS).toBe(3);
    expect(signal(edge, "steps").state).toBe("measured");
  });

  it("withholds a change until there are two readings to compare", () => {
    // One measurement rendered as "0.0 kg" is an invented claim of stability.
    const one = buildLiveSignals({ health: [], body: [body(today, { weight_kg: 78.6 })], today });
    expect(signal(one, "weight").delta).toBeNull();

    const two = buildLiveSignals({
      health: [],
      body: [body(today, { weight_kg: 78.6 }), body("2026-09-01", { weight_kg: 78.9 })],
      today,
    });
    expect(signal(two, "weight")).toMatchObject({ value: 78.6, delta: -0.3 });
  });

  it("takes one reading per day and ignores the rest", () => {
    // A watch can write the same day twice. Comparing those two produces a
    // change of nothing against nothing.
    const signals = buildLiveSignals({
      health: [health(today, { hrv_ms: 68 }), health(today, { hrv_ms: 71 })],
      body: [],
      today,
    });
    expect(signal(signals, "hrv").value).toBe(68);
    expect(signal(signals, "hrv").delta).toBeNull();
  });

  it("compares against the last day that carried the signal, not the last row", () => {
    // A watch that syncs steps every day but weighs HRV weekly must still get
    // a week-apart HRV comparison rather than none.
    const signals = buildLiveSignals({
      health: [
        health(today, { hrv_ms: 68, steps: 9000 }),
        health("2026-09-05", { steps: 8000 }),
        health("2026-08-30", { hrv_ms: 60 }),
      ],
      body: [],
      today,
    });
    expect(signal(signals, "hrv").delta).toBe(8);
    expect(signal(signals, "steps").delta).toBe(1000);
  });

  it("summarises the rail without calling a lapsed watch disconnected", () => {
    const signals = buildLiveSignals({
      health: [health("2026-07-01", { hrv_ms: 60 })],
      body: [body(today, { weight_kg: 78 })],
      today,
    });
    const summary = liveSignalsSummary(signals);
    expect(summary).toMatchObject({ total: 7, measured: 1, stale: 1, connected: 2, silent: false });

    const nothing = liveSignalsSummary(buildLiveSignals({ health: [], body: [], today }));
    expect(nothing.silent).toBe(true);

    // A failed read is not silence: it is a question we could not answer.
    const failed = liveSignalsSummary(buildLiveSignals({ health: null, body: null, today }));
    expect(failed.silent).toBe(false);
    expect(failed.unreadable).toBe(7);
  });
});
