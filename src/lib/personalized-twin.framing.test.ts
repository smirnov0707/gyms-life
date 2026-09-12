import { describe, expect, it } from "vitest";
import { assessTwinFraming } from "./personalized-twin.framing";

describe("Personalized Twin framing", () => {
  it("stays unknown until a real on-device body observation exists", () => {
    expect(assessTwinFraming(null)).toEqual({
      status: "unknown",
      automatic: false,
      bodyHeightRatio: null,
    });
  });

  it("classifies a measured full-body box without inventing confidence", () => {
    expect(
      assessTwinFraming({
        bodyHeightRatio: 0.76,
        topMarginRatio: 0.12,
        bottomMarginRatio: 0.12,
        fullBodyVisible: true,
      }),
    ).toEqual({ status: "ready", automatic: true, bodyHeightRatio: 0.76 });
  });
  it("distinguishes cropped, too close and too far observations", () => {
    expect(
      assessTwinFraming({
        bodyHeightRatio: 0.75,
        topMarginRatio: 0.01,
        bottomMarginRatio: 0.24,
        fullBodyVisible: true,
      }),
    ).toMatchObject({ status: "cropped" });
    expect(
      assessTwinFraming({
        bodyHeightRatio: 0.94,
        topMarginRatio: 0.03,
        bottomMarginRatio: 0.03,
        fullBodyVisible: true,
      }),
    ).toMatchObject({ status: "too_close" });
    expect(
      assessTwinFraming({
        bodyHeightRatio: 0.4,
        topMarginRatio: 0.3,
        bottomMarginRatio: 0.3,
        fullBodyVisible: true,
      }),
    ).toMatchObject({ status: "too_far" });
  });
});
