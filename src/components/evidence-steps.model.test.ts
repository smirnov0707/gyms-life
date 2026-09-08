import { describe, expect, it } from "vitest";
import { buildEvidenceReport, evidenceLevelFor } from "@/lib/evidence-level.engine";
import { EVIDENCE_STEP_COUNT, evidenceSteps } from "./evidence-steps.model";

/**
 * The engine keeps "nothing has ever predicted this" apart from "predictions
 * exist and too few have resolved", and says in its own comment why. The four
 * steps beside each target were drawn from the level alone, which is
 * `insufficient` in both cases, so both drew the same mark.
 */

describe("the evidence steps beside a target", () => {
  it("fills up to the level a modelled target is at", () => {
    expect(evidenceSteps({ modelled: true, level: "insufficient" })).toEqual([
      "current",
      "empty",
      "empty",
      "empty",
    ]);
    expect(evidenceSteps({ modelled: true, level: "early" })).toEqual([
      "reached",
      "current",
      "empty",
      "empty",
    ]);
    expect(evidenceSteps({ modelled: true, level: "strong" })).toEqual([
      "reached",
      "reached",
      "reached",
      "current",
    ]);
  });

  it("leaves the track empty for a target nothing has ever predicted", () => {
    // A level is a position on a scale, and this target is not on it.
    expect(evidenceSteps({ modelled: false, level: "insufficient" })).toEqual([
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("draws a different mark for never-predicted than for too-few-resolved", () => {
    // The failure this file was written for. Both carry level `insufficient`,
    // because `evidenceLevelFor(0)` is what the arithmetic returns for a
    // target with no predictions behind it.
    expect(evidenceLevelFor(0)).toBe("insufficient");
    expect(evidenceSteps({ modelled: false, level: "insufficient" })).not.toEqual(
      evidenceSteps({ modelled: true, level: "insufficient" }),
    );
  });

  it("always draws the same number of steps, so the column stays a scale", () => {
    for (const level of ["insufficient", "early", "moderate", "strong"] as const) {
      for (const modelled of [true, false]) {
        expect(evidenceSteps({ modelled, level })).toHaveLength(EVIDENCE_STEP_COUNT);
      }
    }
  });
});

describe("against a report the engine actually built", () => {
  it("separates a target with no predictions from one with a few", () => {
    const report = buildEvidenceReport({
      counts: [{ target: "readiness", captured: 3, evaluated: 3, pending: 0 }],
      minimumEvaluated: 8,
    });
    if (report.status !== "counted") throw new Error("expected a counted report");

    const tried = report.targets.find((entry) => entry.target === "readiness");
    const never = report.targets.find((entry) => entry.target !== "readiness");
    if (!tried || !never) throw new Error("expected both kinds of target in the report");

    // Same level, deliberately: the engine's `modelled` flag is what tells
    // them apart, and now the shape reads it too.
    expect(tried.level).toBe(never.level);
    expect(tried.modelled).toBe(true);
    expect(never.modelled).toBe(false);
    expect(evidenceSteps(tried)).not.toEqual(evidenceSteps(never));
    expect(evidenceSteps(never).every((step) => step === "empty")).toBe(true);
  });
});
