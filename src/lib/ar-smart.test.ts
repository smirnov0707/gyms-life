import { describe, expect, it } from "vitest";
import { AR_EXERCISES, LM, type Point } from "./ar-angles";
import { RepAnalyser, summarizeSet, type RepRecord } from "./ar-smart";

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
