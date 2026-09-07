import { describe, expect, it } from "vitest";
import { buildSleepNight, type SleepStageRow } from "./sleep-stages.engine";

const row = (over: Partial<SleepStageRow>): SleepStageRow => ({
  sample_on: "2026-09-06",
  source: "apple_health",
  sleep_hours: null,
  sleep_awake_minutes: null,
  sleep_rem_minutes: null,
  sleep_deep_minutes: null,
  sleep_core_minutes: null,
  ...over,
});

describe("buildSleepNight", () => {
  it("tells an unread table from one with no nights in it", () => {
    expect(buildSleepNight({ rows: null, today: "2026-09-07" })).toEqual({ status: "unreadable" });
    expect(buildSleepNight({ rows: [], today: "2026-09-07" }).status).toBe("absent");
  });

  it("reports a duration with no stages as exactly that", () => {
    const night = buildSleepNight({
      rows: [row({ sleep_hours: 7.2 })],
      today: "2026-09-07",
    });
    expect(night).toMatchObject({ status: "duration_only", sleepHours: 7.2, ageDays: 1 });
  });

  it("gives each reported stage a share of the whole night", () => {
    const night = buildSleepNight({
      rows: [
        row({
          sleep_hours: 7.2,
          sleep_deep_minutes: 82,
          sleep_rem_minutes: 96,
          sleep_core_minutes: 256,
          sleep_awake_minutes: 24,
        }),
      ],
      today: "2026-09-07",
    });
    expect(night.status).toBe("staged");
    if (night.status !== "staged") return;
    expect(night.slices.map((slice) => slice.stage)).toEqual(["deep", "rem", "core", "awake"]);
    expect(night.stagedMinutes).toBe(458);
    const shares = night.slices.map((slice) => slice.share);
    expect(shares.every((share) => share !== null)).toBe(true);
    const total = shares.reduce((sum: number, share) => sum + (share ?? 0), 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("refuses to give a share when only part of the night was staged", () => {
    // A source that reported deep sleep alone would otherwise show deep sleep
    // as the whole night.
    const night = buildSleepNight({
      rows: [row({ sleep_hours: 7.2, sleep_deep_minutes: 82 })],
      today: "2026-09-07",
    });
    expect(night.status).toBe("staged");
    if (night.status !== "staged") return;
    expect(night.slices).toEqual([{ stage: "deep", minutes: 82, share: null }]);
  });

  it("shows sleep the source reported and never placed in a stage", () => {
    // 7.2 h is 432 minutes; the three sleep stages cover 380 of them.
    const night = buildSleepNight({
      rows: [
        row({
          sleep_hours: 7.2,
          sleep_deep_minutes: 80,
          sleep_rem_minutes: 90,
          sleep_core_minutes: 210,
        }),
      ],
      today: "2026-09-07",
    });
    expect(night.status === "staged" && night.unattributedMinutes).toBe(52);
  });

  it("does not call rounding a gap", () => {
    const night = buildSleepNight({
      rows: [
        row({
          sleep_hours: 7.2,
          sleep_deep_minutes: 82,
          sleep_rem_minutes: 96,
          sleep_core_minutes: 256,
        }),
      ],
      today: "2026-09-07",
    });
    // The stages exceed the rounded duration by two minutes. That is not
    // missing sleep, so nothing is reported.
    expect(night.status === "staged" && night.unattributedMinutes).toBeNull();
  });

  it("picks the newest night rather than the first row handed over", () => {
    const night = buildSleepNight({
      rows: [
        row({ sample_on: "2026-09-01", sleep_hours: 5 }),
        row({ sample_on: "2026-09-06", sleep_hours: 8 }),
      ],
      today: "2026-09-07",
    });
    expect(night).toMatchObject({ night: "2026-09-06", sleepHours: 8, ageDays: 1 });
  });

  it("counts how old the night is, so a stale one can say so", () => {
    const night = buildSleepNight({
      rows: [row({ sample_on: "2026-09-01", sleep_hours: 7 })],
      today: "2026-09-07",
    });
    expect(night.status === "duration_only" && night.ageDays).toBe(6);
  });
});
