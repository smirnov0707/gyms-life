import { describe, expect, it } from "vitest";
import { LIVE_SIGNAL_IDS, type LiveSignal } from "./live-signals.engine";
import { signalRefreshOutcome } from "./live-signal-refresh";

const empty = (): LiveSignal[] =>
  LIVE_SIGNAL_IDS.map((id) => ({
    id,
    state: "absent",
    value: null,
    recordedOn: null,
    ageDays: null,
    delta: null,
    source: null,
    history: [],
  }));
describe("manual refresh outcome", () => {
  it("distinguishes an empty readable account from a failed read", () => {
    expect(signalRefreshOutcome(empty())).toBe("empty");
    expect(signalRefreshOutcome([])).toBe("unreadable");
    expect(signalRefreshOutcome(empty().map((row) => ({ ...row, state: "unreadable" })))).toBe(
      "unreadable",
    );
  });
  it("does not call an incomplete response a completed refresh", () => {
    expect(signalRefreshOutcome(empty().slice(1))).toBe("partial");
    expect(
      signalRefreshOutcome(
        empty().map((row, i) => (i === 0 ? { ...row, state: "unreadable" } : row)),
      ),
    ).toBe("partial");
  });
  it("preserves a measured zero rather than inventing an empty result", () => {
    expect(
      signalRefreshOutcome(
        empty().map((row) => (row.id === "steps" ? { ...row, state: "measured", value: 0 } : row)),
      ),
    ).toBe("refreshed");
  });
  it("identifies old readings instead of implying they are current", () => {
    expect(
      signalRefreshOutcome(
        empty().map((row) => (row.id === "sleep" ? { ...row, state: "stale", value: 7 } : row)),
      ),
    ).toBe("stale");
  });
  it("rejects duplicate signal identities", () => {
    const rows = empty();
    const first = rows[0];
    if (!first) throw new Error("Fixture must contain signals");
    expect(signalRefreshOutcome([...rows, first])).toBe("unreadable");
  });
  it("does not accept invalid measured values as readable", () => {
    expect(
      signalRefreshOutcome(
        empty().map((row) =>
          row.id === "sleep" ? { ...row, state: "measured", value: NaN } : row,
        ),
      ),
    ).toBe("partial");
  });
});
