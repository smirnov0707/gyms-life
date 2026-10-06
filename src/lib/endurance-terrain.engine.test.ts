import { describe, expect, it } from "vitest";
import { classifyTerrain, assessTerrainResponse } from "./endurance-terrain.engine";
const r = (day: string, gain: number, min: number) => ({
  day,
  distanceMeters: 10000,
  elevationGainMeters: gain,
  durationSeconds: min * 60,
  averageHeartRateBpm: null,
});
describe("terrain intelligence", () => {
  it("classifies measured gain density", () => {
    expect(classifyTerrain(r("1", 250, 60)).classification).toBe("hilly");
    expect(classifyTerrain(r("1", 30, 50)).classification).toBe("flat");
  });
  it("does not invent terrain response from one pair", () =>
    expect(assessTerrainResponse([r("1", 20, 50), r("2", 250, 60)]).status).toBe(
      "insufficient_evidence",
    ));
  it("learns observed response only with repeated contexts", () => {
    const x = [
      r("1", 20, 50),
      r("2", 30, 51),
      r("3", 40, 49),
      r("4", 250, 60),
      r("5", 300, 61),
      r("6", 220, 59),
    ];
    expect(assessTerrainResponse(x).status).toBe("measured");
  });
});
