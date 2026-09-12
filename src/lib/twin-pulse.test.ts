import { describe, expect, it } from "vitest";
import type { LiveSignal, LiveSignalId } from "./live-signals.engine";
import { buildSinceYesterday, buildTwinPulse } from "./twin-pulse";

function signal(
  id: LiveSignalId,
  delta: number | null,
  state: LiveSignal["state"] = "measured",
): LiveSignal {
  return {
    id,
    state,
    value: state === "measured" ? 1 : null,
    recordedOn: "2026-09-12",
    ageDays: 0,
    delta,
    source: "device",
    history: [],
  };
}

describe("Twin Pulse", () => {
  it("builds only from measured recovery factors", () => {
    expect(
      buildTwinPulse([signal("sleep", 0.5), signal("hrv", 4), signal("restingHr", -2)]),
    ).toMatchObject({
      state: "build",
      direction: "rising",
      measuredFactorCount: 3,
      decisionAuthority: false,
    });
  });
  it("stays uncertain when evidence is too thin", () => {
    expect(buildTwinPulse([signal("sleep", 0.4), signal("hrv", null)])).toMatchObject({
      state: "uncertain",
      direction: "uncertain",
    });
  });
  it("reports only actual measured changes since yesterday", () => {
    expect(
      buildSinceYesterday([signal("sleep", 0.4), signal("weight", 0), signal("hrv", 2, "stale")]),
    ).toEqual([{ id: "sleep", direction: "rising", delta: 0.4 }]);
  });
});
