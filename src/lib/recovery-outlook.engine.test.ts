import { describe, expect, it } from "vitest";
import { MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS } from "./muscle-load.engine";
import {
  buildRecoveryOutlook,
  hoursToRecovery,
  projectRecovery,
  RECOVERY_HORIZON_HOURS,
} from "./recovery-outlook.engine";

describe("projectRecovery", () => {
  it("halves the remaining fatigue on the model's own schedule", () => {
    // One time constant leaves e^-1 of the fatigue, whatever it started at.
    const after = projectRecovery(40, MUSCLE_LOAD_DECAY_TIME_CONSTANT_HOURS);
    expect(after).toBeCloseTo(100 - 60 * Math.exp(-1), 6);
  });

  it("stands still at zero hours, and never goes backwards", () => {
    expect(projectRecovery(41, 0)).toBe(41);
    expect(projectRecovery(41, 24)).toBeGreaterThan(41);
    expect(projectRecovery(41, 240)).toBeLessThan(100);
  });

  it("leaves a fully recovered region where it is", () => {
    expect(projectRecovery(100, 48)).toBe(100);
  });
});

describe("hoursToRecovery", () => {
  it("is the inverse of the projection", () => {
    const hours = hoursToRecovery(41, 80);
    expect(hours).not.toBeNull();
    if (hours === null) return;
    expect(projectRecovery(41, hours)).toBeCloseTo(80, 0);
  });

  it("is zero for a region already there, not null", () => {
    // A region at the threshold needs no waiting. Omitting it would read as
    // "we cannot say", which is a different thing.
    expect(hoursToRecovery(80, 80)).toBe(0);
    expect(hoursToRecovery(96, 80)).toBe(0);
  });

  it("says nothing rather than a number beyond the horizon", () => {
    // An exponential reaches any target eventually; past a week the answer is
    // dominated by the assumption that nothing gets trained, which is false.
    expect(hoursToRecovery(0, 95)).toBeNull();
    const withinHorizon = hoursToRecovery(0, 80);
    expect(withinHorizon).not.toBeNull();
    expect(withinHorizon ?? Infinity).toBeLessThanOrEqual(RECOVERY_HORIZON_HOURS);
  });

  it("refuses a target an exponential never reaches", () => {
    expect(hoursToRecovery(50, 100)).toBeNull();
  });
});

describe("buildRecoveryOutlook", () => {
  it("tells an unread snapshot from a body with nothing recovering", () => {
    expect(buildRecoveryOutlook({ regions: null })).toEqual({ status: "unreadable" });
    const empty = buildRecoveryOutlook({ regions: [] });
    expect(empty.status).toBe("projected");
    expect(empty.status === "projected" && empty.recovering).toEqual([]);
  });

  it("lists what is still recovering, soonest back first", () => {
    const outlook = buildRecoveryOutlook({
      regions: [
        { region: "chest", recoveryPct: 41 },
        { region: "back", recoveryPct: 55 },
        { region: "quads", recoveryPct: 92 },
      ],
    });
    expect(outlook.status).toBe("projected");
    if (outlook.status !== "projected") return;
    expect(outlook.recovering.map((entry) => entry.region)).toEqual(["back", "chest"]);
    expect(outlook.readyCount).toBe(1);
  });

  it("counts regions with no calculated recovery instead of dropping them", () => {
    // An outlook that silently listed six of nine regions would read as a body
    // three regions smaller than it is.
    const outlook = buildRecoveryOutlook({
      regions: [
        { region: "chest", recoveryPct: 41 },
        { region: "calves", recoveryPct: null },
        { region: "neck", recoveryPct: null },
      ],
    });
    expect(outlook.status === "projected" && outlook.unknownCount).toBe(2);
    expect(outlook.status === "projected" && outlook.recovering.length).toBe(1);
  });

  it("sorts a region beyond the horizon last, where it belongs", () => {
    const outlook = buildRecoveryOutlook({
      regions: [
        { region: "chest", recoveryPct: 0 },
        { region: "back", recoveryPct: 70 },
      ],
    });
    if (outlook.status !== "projected") return;
    // Chest reaches the ready threshold within the week; it is simply later.
    expect(outlook.recovering.map((entry) => entry.region)).toEqual(["back", "chest"]);
    expect(outlook.recovering[1]?.hoursToFull).toBeNull();
  });
});
