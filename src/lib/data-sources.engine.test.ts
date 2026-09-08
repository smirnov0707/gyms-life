import { describe, expect, it } from "vitest";
import {
  ALL_SOURCE_SIGNALS,
  DEVICE_SIGNALS,
  MANUAL_SIGNALS,
  anythingReadable,
  newestReading,
  sourceState,
} from "./data-sources.engine";
import type { LiveSignal, LiveSignalId, LiveSignalState } from "./live-signals.engine";

/**
 * The strip exists to tell the athlete whether to go and fix their watch. Every
 * wrong answer here is either a false alarm or, worse, a reassurance: it said
 * "Delivering" for a source that had been quiet for weeks, in eight languages,
 * all of them present tense.
 */

const signal = (id: LiveSignalId, state: LiveSignalState, recordedOn?: string): LiveSignal => {
  const read = state === "measured" || state === "stale";
  return {
    id,
    state,
    value: read ? 1 : null,
    recordedOn: recordedOn ?? (read ? "2026-09-01" : null),
    ageDays: read ? 0 : null,
    delta: null,
    source: read ? "watch" : null,
    history: [],
  };
};

describe("data sources", () => {
  it("shows every signal the app has under one source or the other", () => {
    // A signal in neither group is one the strip silently never reports on:
    // it would be measured, stored, drawn on the rail, and invisible here.
    const covered = [...DEVICE_SIGNALS, ...MANUAL_SIGNALS];
    for (const id of ALL_SOURCE_SIGNALS) expect(covered).toContain(id);
    expect(new Set(covered).size).toBe(covered.length);
  });

  describe("one source's state", () => {
    it("is delivering when something arrived recently", () => {
      expect(sourceState([signal("sleep", "measured")], DEVICE_SIGNALS)).toBe("delivering");
    });

    it("is quiet when it has delivered before but nothing lately", () => {
      // The failure this file was written for. Every one of these signals has
      // a real reading behind it, so the old code called the watch
      // "Delivering" — present tense, in every language — while it had in fact
      // stopped, which is exactly the thing the athlete needed to be told.
      const stale = DEVICE_SIGNALS.map((id) => signal(id, "stale"));
      expect(sourceState(stale, DEVICE_SIGNALS)).toBe("quiet");
    });

    it("is silent when it has never delivered anything", () => {
      const never = DEVICE_SIGNALS.map((id) => signal(id, "absent"));
      expect(sourceState(never, DEVICE_SIGNALS)).toBe("silent");
    });

    it("is unknown when it could not be checked", () => {
      const failed = DEVICE_SIGNALS.map((id) => signal(id, "unreadable"));
      expect(sourceState(failed, DEVICE_SIGNALS)).toBe("unknown");
    });

    it("is unknown when there is nothing to go on at all", () => {
      expect(sourceState([], DEVICE_SIGNALS)).toBe("unknown");
    });

    it("lets one arriving reading outrank a sibling it could not read", () => {
      // A measurement that arrived did arrive. Downgrading the whole source
      // because a second query failed would hide a working connection.
      const mixed = [signal("sleep", "measured"), signal("hrv", "unreadable")];
      expect(sourceState(mixed, DEVICE_SIGNALS)).toBe("delivering");
    });

    it("prefers 'could not check' over both of the quiet answers", () => {
      // `quiet` and `silent` are claims about the athlete's device; `unknown`
      // is a claim about us, and with a failed read in the set it is the only
      // one we can stand behind.
      expect(
        sourceState([signal("sleep", "stale"), signal("hrv", "unreadable")], DEVICE_SIGNALS),
      ).toBe("unknown");
      expect(
        sourceState([signal("sleep", "absent"), signal("hrv", "unreadable")], DEVICE_SIGNALS),
      ).toBe("unknown");
    });

    it("prefers 'quiet' over 'silent', because they ask for different things", () => {
      // One is a connection that stopped; the other is one never made.
      const mixed = [signal("sleep", "stale"), signal("hrv", "absent")];
      expect(sourceState(mixed, DEVICE_SIGNALS)).toBe("quiet");
    });

    it("reads only its own signals", () => {
      // A weigh-in this morning must not make the watch look like it is
      // sending, and a dead watch must not make the scale look dead.
      const signals = [signal("weight", "measured"), signal("sleep", "absent")];
      expect(sourceState(signals, DEVICE_SIGNALS)).toBe("silent");
      expect(sourceState(signals, MANUAL_SIGNALS)).toBe("delivering");
    });
  });

  describe("the newest reading", () => {
    it("is the latest day any source recorded", () => {
      expect(
        newestReading([
          signal("sleep", "stale", "2026-08-02"),
          signal("weight", "measured", "2026-09-07"),
          signal("hrv", "stale", "2026-08-30"),
        ]),
      ).toBe("2026-09-07");
    });

    it("ignores signals that carry no day", () => {
      expect(newestReading([signal("sleep", "absent"), signal("hrv", "unreadable")])).toBeNull();
    });

    it("is null when there is nothing at all", () => {
      expect(newestReading([])).toBeNull();
    });
  });

  describe("whether anything could be read", () => {
    it("is false only when every single signal failed", () => {
      expect(anythingReadable(ALL_SOURCE_SIGNALS.map((id) => signal(id, "unreadable")))).toBe(
        false,
      );
      expect(anythingReadable([signal("sleep", "unreadable"), signal("weight", "absent")])).toBe(
        true,
      );
    });

    it("is false with nothing to go on, so the strip says nothing it cannot", () => {
      expect(anythingReadable([])).toBe(false);
    });
  });
});
