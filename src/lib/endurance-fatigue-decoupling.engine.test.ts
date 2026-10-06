import { describe, expect, it } from "vitest";
import { assessFatigueDecoupling } from "./endurance-fatigue-decoupling.engine";
describe("fatigue decoupling", () => {
  it("requires six splits", () =>
    expect(assessFatigueDecoupling([]).status).toBe("insufficient_evidence"));
  it("detects multi-signal late-run deterioration", () => {
    const x = [1, 2, 3]
      .map((index) => ({
        index,
        distanceMeters: 1000,
        durationSeconds: 300,
        averageHeartRateBpm: 145,
        cadenceSpm: 176,
      }))
      .concat(
        [4, 5, 6].map((index) => ({
          index,
          distanceMeters: 1000,
          durationSeconds: 320,
          averageHeartRateBpm: 155,
          cadenceSpm: 170,
        })),
      );
    expect(assessFatigueDecoupling(x).pattern).toBe("multi_signal_fatigue");
  });
});
