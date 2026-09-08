import { describe, expect, it } from "vitest";
import { AR_EXERCISES, LM, type Point } from "./ar-angles";
import { RepAnalyser, detectExercise, summarizeSet, type RepRecord } from "./ar-smart";

/**
 * A rep is counted from the angle at one joint, and that angle used to be read
 * off landmarks the pose model had no confidence in — so an athlete drifting
 * out of frame had reps counted from where the model guessed their knee might
 * be. These pin the counting to what the camera could actually see.
 */

const at = (x: number, y: number, visibility = 0.95): Point => ({ x, y, visibility });

/**
 * A squat pose with the knee at roughly `kneeDegrees`, built by placing the
 * ankle on a circle around the knee.
 */
function squatPose(kneeDegrees: number, visibility = 0.95): Point[] {
  const radians = (kneeDegrees * Math.PI) / 180;
  const pose: Point[] = [];
  pose[LM.rShoulder] = at(0.5, 0.1, visibility);
  pose[LM.rHip] = at(0.5, 0.4, visibility);
  pose[LM.rKnee] = at(0.5, 0.7, visibility);
  // Hip sits straight above the knee, so the ankle's angle from vertical is
  // the knee angle itself.
  pose[LM.rAnkle] = at(0.5 + 0.3 * Math.sin(radians), 0.7 - 0.3 * Math.cos(radians), visibility);
  return pose;
}

const squat = AR_EXERCISES.find((exercise) => exercise.slug === "squat")!;

describe("RepAnalyser", () => {
  it("counts a rep that goes down and comes back up", () => {
    const analyser = new RepAnalyser(squat);
    expect(analyser.push(squatPose(170), "en", 0)).toBeNull();
    expect(analyser.push(squatPose(90), "en", 500)).toBeNull();
    const rep = analyser.push(squatPose(170), "en", 1500);
    expect(rep).not.toBeNull();
    expect(rep?.index).toBe(1);
  });

  it("counts nothing at all from joints the camera cannot see", () => {
    // Low-confidence landmarks are the model guessing where a joint might be.
    // Starting and closing reps off them invents training that never happened.
    const analyser = new RepAnalyser(squat);
    expect(analyser.push(squatPose(170, 0.1), "en", 0)).toBeNull();
    expect(analyser.push(squatPose(90, 0.1), "en", 500)).toBeNull();
    expect(analyser.push(squatPose(170, 0.1), "en", 1500)).toBeNull();
    expect(analyser.reps).toEqual([]);
  });

  it("stops counting the moment the camera loses the joint mid-rep", () => {
    // The rep opens on visible landmarks and then the athlete steps out of
    // frame. The closing frame must not be read off landmarks the model is
    // guessing at.
    const analyser = new RepAnalyser(squat);
    analyser.push(squatPose(170), "en", 0);
    analyser.push(squatPose(90), "en", 500);
    expect(analyser.push(squatPose(170, 0.05), "en", 1500)).toBeNull();
    expect(analyser.reps).toEqual([]);
  });

  it("scores a rep it could actually see", () => {
    const analyser = new RepAnalyser(squat);
    analyser.push(squatPose(170), "en", 0);
    analyser.push(squatPose(90), "en", 600);
    analyser.push(squatPose(95), "en", 1200);
    const rep = analyser.push(squatPose(170), "en", 2000);
    expect(typeof rep?.score).toBe("number");
  });
});

describe("summarizeSet", () => {
  const rep = (over: Partial<RepRecord>): RepRecord => ({
    index: 1,
    score: 90,
    down: 1.5,
    up: 1.2,
    bottomAngle: 92,
    asymmetry: 3,
    fix: "",
    ...over,
  });

  it("averages the reps it was given", () => {
    const summary = summarizeSet([rep({ score: 90 }), rep({ index: 2, score: 70 })], "en");
    expect(summary?.score).toBe(80);
    expect(summary?.reps).toBe(2);
  });

  it("reports nothing for a set with no reps", () => {
    expect(summarizeSet([], "en")).toBeNull();
  });

  it("withholds symmetry the camera never had both sides for", () => {
    // Filming a squat side-on hides the left side entirely. The comparison
    // was never made, and zero would report the set as symmetrical on the
    // strength of the camera angle.
    const summary = summarizeSet(
      [rep({ asymmetry: null }), rep({ index: 2, asymmetry: null })],
      "en",
    );
    expect(summary?.asymmetry).toBeNull();
  });

  it("averages symmetry over only the reps that had both sides", () => {
    const summary = summarizeSet(
      [rep({ asymmetry: 12 }), rep({ index: 2, asymmetry: null }), rep({ index: 3, asymmetry: 8 })],
      "en",
    );
    expect(summary?.asymmetry).toBe(10);
  });
});

/**
 * Every angle this module measures is a right-side angle, so it expects a
 * right-side-on camera — the view in which the athlete's left shoulder, hip and
 * ankle are exactly the ones behind their body. The completeness gate only ever
 * checked the right side, so the left landmarks arrived unvalidated and their
 * absence was read as a coordinate of zero.
 */
describe("detectExercise from a side-on camera", () => {
  /** One frame of a standing pose with the knee bent to `kneeDegrees`. */
  function standing(kneeDegrees: number, options: { leftVisible: boolean; footSplit?: number }) {
    const radians = (kneeDegrees * Math.PI) / 180;
    const pose: Point[] = [];
    const visible = options.leftVisible ? 0.95 : 0.1;
    const ankleX = 0.5 + 0.3 * Math.sin(radians);
    pose[LM.rShoulder] = at(0.5, 0.1);
    pose[LM.rElbow] = at(0.5, 0.3);
    pose[LM.rWrist] = at(0.5, 0.5);
    pose[LM.rHip] = at(0.5, 0.4);
    pose[LM.rKnee] = at(0.5, 0.7);
    pose[LM.rAnkle] = at(ankleX, 0.7 - 0.3 * Math.cos(radians));
    // A body has width: the shoulders are 0.16 apart, and the left foot sits
    // beside the right one unless the stance is deliberately split.
    pose[LM.lShoulder] = at(0.34, 0.1, visible);
    pose[LM.lHip] = at(0.36, 0.4, visible);
    pose[LM.lAnkle] = at(ankleX - (options.footSplit ?? 0.03), 0.95, visible);
    return pose;
  }

  const window = (poses: Point[][]) => poses.map((pose, index) => ({ pose, t: index * 100 }));

  /** A squat: knees travel, feet together. */
  const squatting = (leftVisible: boolean) =>
    window(
      Array.from({ length: 16 }, (_, index) =>
        standing(index % 2 === 0 ? 170 : 90, { leftVisible, footSplit: 0.03 }),
      ),
    );

  it("still reads a squat when both sides are in view", () => {
    expect(detectExercise(squatting(true))).toBe("squat");
  });

  it("still reads a squat when the far side of the body is hidden", () => {
    // The frames are identical apart from the confidence on the left
    // landmarks. Nothing about the movement changed, so nothing about the
    // answer should.
    expect(detectExercise(squatting(false))).toBe("squat");
  });

  it("does not call a squat a lunge on the strength of a landmark it cannot see", () => {
    // The failure this covers. The pose model never omits a landmark — it
    // returns all of them every frame, each with a confidence — so the hidden
    // left ankle arrives with a position the model guessed at. Here that guess
    // lands far from the real foot, which is what low confidence means, and the
    // apparent gap between the feet is then wide enough to call a lunge. The
    // knee travel is a real squat and the split is not measurable at all.
    const guessedFarFoot = window(
      Array.from({ length: 16 }, (_, index) =>
        standing(index % 2 === 0 ? 170 : 90, { leftVisible: false, footSplit: 0.45 }),
      ),
    );
    expect(detectExercise(guessedFarFoot)).toBe("squat");
  });

  it("still calls a real split stance a lunge when it can see both feet", () => {
    const lunging = window(
      Array.from({ length: 16 }, (_, index) =>
        standing(index % 2 === 0 ? 170 : 90, { leftVisible: true, footSplit: 0.45 }),
      ),
    );
    expect(detectExercise(lunging)).toBe("lunge");
  });
});
