import { describe, expect, it } from "vitest";
import { assessLongRunProgress, raceSpecificLongRunCoverage } from "./endurance-long-run.engine";
describe("long run progression", () => {
  it("detects progression from longitudinal evidence", () => {
    expect(
      assessLongRunProgress([
        { day: "2026-09-01", distanceMeters: 9000 },
        { day: "2026-09-10", distanceMeters: 10000 },
        { day: "2026-09-20", distanceMeters: 12000 },
        { day: "2026-10-01", distanceMeters: 14000 },
      ]).status,
    ).toBe("progressing");
  });
  it("does not invent a trend from one run", () => {
    expect(assessLongRunProgress([{ day: "2026-10-01", distanceMeters: 18000 }]).status).toBe(
      "insufficient_evidence",
    );
  });
  it("caps race coverage at one", () => {
    expect(raceSpecificLongRunCoverage(25000, 21097.5)).toBe(1);
  });
});
