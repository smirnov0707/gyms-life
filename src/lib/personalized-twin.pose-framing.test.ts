import { describe, expect, it } from "vitest";
import { observationFromPoseLandmarks } from "./personalized-twin.pose-framing";

function pose() {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  points[0] = { x: 0.5, y: 0.1, visibility: 0.9 };
  points[11] = { x: 0.42, y: 0.28, visibility: 0.9 };
  points[12] = { x: 0.58, y: 0.28, visibility: 0.9 };
  points[23] = { x: 0.45, y: 0.55, visibility: 0.9 };
  points[24] = { x: 0.55, y: 0.55, visibility: 0.9 };
  points[27] = { x: 0.46, y: 0.88, visibility: 0.9 };
  points[28] = { x: 0.54, y: 0.88, visibility: 0.9 };
  return points;
}

describe("Personalized Twin pose framing", () => {
  it("builds a full-body observation entirely from local pose landmarks", () => {
    const result = observationFromPoseLandmarks(pose());
    expect(result).toMatchObject({ fullBodyVisible: true });
    expect(result?.bodyHeightRatio).toBeCloseTo(0.78, 2);
  });
  it("marks the observation incomplete when a required ankle is not visible", () => {
    const points = pose();
    points[28] = { ...points[28]!, visibility: 0.1 };
    expect(observationFromPoseLandmarks(points)).toMatchObject({ fullBodyVisible: false });
  });

  it("returns unknown input when there is no usable pose", () => {
    expect(observationFromPoseLandmarks(undefined)).toBeNull();
    expect(observationFromPoseLandmarks([])).toBeNull();
  });
});
