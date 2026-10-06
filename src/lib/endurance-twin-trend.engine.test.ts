import { describe, expect, it } from "vitest";
import { assessAerobicEfficiencyTrend } from "./endurance-twin-trend.engine";
describe("endurance twin trend", () => {
  it("requires six measured sessions", () =>
    expect(
      assessAerobicEfficiencyTrend([
        { day: "1", aerobicDrift: -0.02, cadenceStability: null, paceStability: null },
      ]).status,
    ).toBe("insufficient_evidence"));
  it("detects improving drift longitudinally", () => {
    const vals = [0.01, 0.02, 0.01, -0.04, -0.05, -0.04].map((v, i) => ({
      day: String(i),
      aerobicDrift: v,
      cadenceStability: null,
      paceStability: null,
    }));
    expect(assessAerobicEfficiencyTrend(vals).status).toBe("improving");
  });
});
