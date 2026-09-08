import { describe, expect, it } from "vitest";
import { LM, type Point } from "./ar-angles";
import { CALIBRATION_MINIMUM_QUALITY, evaluateStep, type CalibFrame } from "./ar-calibration";

/**
 * Calibration is where pixels become centimetres. Everything the athlete is
 * later told about how deep they squatted rests on the `cmPerPx` this step
 * derives, so the properties worth pinning are about when it refuses to derive
 * one at all.
 *
 * Only the "stand" step is reachable — the route calls nothing else — so that
 * is what these cover.
 */

const HEIGHT_CM = 180;

const at = (x: number, y: number, visibility = 0.95): Point => ({ x, y, visibility });

/**
 * A frame of someone standing still and filling most of the picture.
 *
 * `jitterPx` moves the hips between frames; `visibility` lowers the model's
 * confidence in every landmark at once.
 */
function standingFrame(options: { jitter?: number; visibility?: number } = {}): CalibFrame {
  const vis = options.visibility ?? 0.95;
  const jitter = options.jitter ?? 0;
  const pose: Point[] = [];
  pose[LM.nose] = at(0.5, 0.08, vis);
  pose[LM.lShoulder] = at(0.44, 0.22, vis);
  pose[LM.rShoulder] = at(0.56, 0.22, vis);
  pose[LM.lHip] = at(0.46, 0.5 + jitter, vis);
  pose[LM.rHip] = at(0.54, 0.5 + jitter, vis);
  pose[LM.lKnee] = at(0.46, 0.72, vis);
  pose[LM.rKnee] = at(0.54, 0.72, vis);
  pose[LM.lAnkle] = at(0.46, 0.94, vis);
  pose[LM.rAnkle] = at(0.54, 0.94, vis);
  return { pose, w: 720, h: 1280 };
}

const frames = (count: number, options: Parameters<typeof standingFrame>[0] = {}) =>
  Array.from({ length: count }, () => standingFrame(options));

describe("evaluateStep — standing", () => {
  it("derives a scale from a clean standing frame", () => {
    const result = evaluateStep("stand", frames(30), HEIGHT_CM, "en");
    expect(result.quality).toBeGreaterThanOrEqual(CALIBRATION_MINIMUM_QUALITY);
    expect(result.cmPerPx).toBeDefined();
    expect(result.standingHipY).toBeDefined();
    // Nose to ankle spans 0.86 of a 1280px frame, and is taken as 93% of a
    // 180cm athlete: roughly 0.15 cm per pixel.
    expect(result.cmPerPx!).toBeCloseTo((HEIGHT_CM * 0.93) / (0.86 * 1280), 4);
  });

  it("returns no scale from a calibration it would itself call bad", () => {
    // Barely visible landmarks. The quality score already knew this was a poor
    // calibration and reported it; the scale was handed over anyway, and every
    // later depth reading was then shown in centimetres.
    const result = evaluateStep("stand", frames(30, { visibility: 0.45 }), HEIGHT_CM, "en");
    expect(result.quality).toBeLessThan(CALIBRATION_MINIMUM_QUALITY);
    expect(result.cmPerPx).toBeUndefined();
    expect(result.standingHipY).toBeUndefined();
  });

  it("refuses a scale built on joints the model is guessing at", () => {
    // Landmarks present, but below the confidence floor: there is no measured
    // body height here, so there is no centimetres-per-pixel either.
    const blind = frames(30).map((frame) => {
      const pose = [...frame.pose];
      pose[LM.nose] = at(0.5, 0.08, 0.1);
      pose[LM.lAnkle] = at(0.46, 0.94, 0.1);
      pose[LM.rAnkle] = at(0.54, 0.94, 0.1);
      return { ...frame, pose };
    });
    expect(evaluateStep("stand", blind, HEIGHT_CM, "en").cmPerPx).toBeUndefined();
  });

  it("reports nothing at all from too few frames", () => {
    const result = evaluateStep("stand", frames(4), HEIGHT_CM, "en");
    expect(result.quality).toBe(0);
    expect(result.cmPerPx).toBeUndefined();
  });

  it("has no scale to give without a real height", () => {
    // A height of zero is the athlete not having entered one. The step still
    // scores the framing, but centimetres are not derivable from it.
    const result = evaluateStep("stand", frames(30), 0, "en");
    expect(result.cmPerPx).toBeUndefined();
  });

  it("scores a jittering athlete below a still one", () => {
    const still = evaluateStep("stand", frames(30), HEIGHT_CM, "en");
    const moving = evaluateStep(
      "stand",
      Array.from({ length: 30 }, (_, index) =>
        standingFrame({ jitter: index % 2 === 0 ? 0.04 : -0.04 }),
      ),
      HEIGHT_CM,
      "en",
    );
    expect(moving.quality).toBeLessThan(still.quality);
  });
});

/**
 * The scale step is not reached from the app today — the AR route only ever
 * runs "stand" — but it is the step that would derive the camera's scale from
 * wingspan against height, and it read its wrists by presence rather than by
 * visibility. Every other landmark read in that file had already been moved to
 * `landmarkVisible`; this one was missed, so it is pinned here for whoever
 * wires the step up.
 */
describe("evaluateStep — scale", () => {
  /** Someone standing with their arms out, wrists as confident as given. */
  function armsOut(wristVisibility: number): CalibFrame {
    const frame = standingFrame();
    // A wingspan about equal to height, which is what a clean scale frame is.
    frame.pose[LM.lWrist] = at(0.06, 0.22, wristVisibility);
    frame.pose[LM.rWrist] = at(0.94, 0.22, wristVisibility);
    return frame;
  }

  const scaleOf = (result: ReturnType<typeof evaluateStep>) =>
    result.metrics.find((metric) => metric.value.endsWith("×"));

  it("measures a wingspan it could see", () => {
    // Asserts that a ratio was produced, not that it passes. Whether it passes
    // depends on the frame's aspect ratio, which this step does not account
    // for — see the note on `evaluateStep`. Pinning a pass here would mean
    // choosing a frame shape to satisfy the arithmetic rather than testing it.
    const result = evaluateStep(
      "scale",
      Array.from({ length: 20 }, () => armsOut(0.95)),
      HEIGHT_CM,
      "en",
    );
    expect(scaleOf(result)).toBeDefined();
  });

  it("measures nothing from wrists the model is guessing at", () => {
    // The frames are identical apart from the confidence on the two wrists.
    // Reading them anyway produces a plausible ratio, a passing score, and a
    // calibration the athlete is told succeeded from a measurement that never
    // happened.
    const result = evaluateStep(
      "scale",
      Array.from({ length: 20 }, () => armsOut(0.1)),
      HEIGHT_CM,
      "en",
    );
    expect(scaleOf(result)).toBeUndefined();
    expect(result.metrics.some((metric) => metric.value === "—")).toBe(true);
  });
});
