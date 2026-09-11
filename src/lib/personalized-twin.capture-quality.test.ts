import { describe, expect, it } from "vitest";
import {
  assessTwinCaptureQuality,
  averageFrameLuminance,
} from "./personalized-twin.capture-quality";

describe("Personalized Twin capture quality", () => {
  it("requires stable framing before rotation can advance", () => {
    expect(
      assessTwinCaptureQuality({
        framingReady: true,
        stableReadyMs: 400,
        luminance: 0.5,
        motionDelta: 0.02,
      }),
    ).toEqual({
      status: "stabilizing",
      canAdvanceRotation: false,
    });
    expect(
      assessTwinCaptureQuality({
        framingReady: true,
        stableReadyMs: 900,
        luminance: 0.5,
        motionDelta: 0.02,
      }),
    ).toEqual({
      status: "ready",
      canAdvanceRotation: true,
    });
  });

  it("blocks poor exposure and fast movement", () => {
    expect(
      assessTwinCaptureQuality({
        framingReady: true,
        stableReadyMs: 1000,
        luminance: 0.1,
        motionDelta: 0.01,
      }).status,
    ).toBe("too_dark");
    expect(
      assessTwinCaptureQuality({
        framingReady: true,
        stableReadyMs: 1000,
        luminance: 0.95,
        motionDelta: 0.01,
      }).status,
    ).toBe("too_bright");
    expect(
      assessTwinCaptureQuality({
        framingReady: true,
        stableReadyMs: 1000,
        luminance: 0.5,
        motionDelta: 0.2,
      }).status,
    ).toBe("moving_too_fast");
  });

  it("computes normalized luminance from a local frame sample", () => {
    expect(averageFrameLuminance(new Uint8ClampedArray([255, 255, 255, 255]))).toBeCloseTo(1);
    expect(averageFrameLuminance(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(0);
  });
});
