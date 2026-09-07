import { describe, expect, it } from "vitest";
import type { TargetState } from "./ar-angles";
import { VoiceCoach } from "./ar-voice-coach";
import type { RepRecord } from "./ar-smart";

/**
 * The voice coach is the one channel the athlete cannot check against
 * anything — it speaks while they are mid-rep and looking at a bar, not a
 * screen. So the property that matters most is that it never asserts
 * something about a body the camera could not see.
 */

const target = (over: Partial<TargetState> = {}): TargetState => ({
  id: "knee",
  label: "Knee angle",
  angle: 88,
  min: 70,
  max: 100,
  status: "ok",
  cue: "",
  vertex: { x: 0.5, y: 0.5 },
  ...over,
});

const rep = (over: Partial<RepRecord> = {}): RepRecord => ({
  index: 1,
  score: 92,
  down: 1.4,
  up: 1.1,
  bottomAngle: 92,
  asymmetry: 4,
  fix: "",
  ...over,
});

const coach = (startedAt = 0) => {
  const instance = new VoiceCoach();
  instance.reset(startedAt);
  return instance;
};

describe("VoiceCoach", () => {
  it("counts the rep it was given", () => {
    const voice = coach();
    expect(voice.tick({ now: 5000, lang: "en", states: [target()], rep: rep(), repCount: 3 })).toBe(
      "3",
    );
  });

  it("says the camera cannot see you, not a technique instruction", () => {
    // An empty evaluation means the joints this exercise is judged on were not
    // visible. It used to answer that with "keep the body tight" — advice
    // about a body nobody was looking at.
    const voice = coach();
    const spoken = voice.tick({ now: 9000, lang: "en", states: [], rep: null, repCount: 0 });
    expect(spoken).toMatch(/can't see you/i);
    expect(spoken).not.toMatch(/body tight/i);
  });

  it("stays quiet on a coach that was never started", () => {
    // `started` is zero until `reset` runs, and every real timestamp is more
    // than four seconds past zero — so a fresh coach used to speak on its
    // very first frame.
    const voice = new VoiceCoach();
    expect(
      voice.tick({ now: 1_700_000_000_000, lang: "en", states: [], rep: null, repCount: 0 }),
    ).toBeNull();
  });

  it("never calls out asymmetry it could not measure", () => {
    // Filming a squat side-on hides the left side entirely, so the comparison
    // was never made. Silence is the honest output; the old zero read as
    // perfect symmetry and this threshold simply never fired on it.
    const voice = coach();
    const spoken = voice.tick({
      now: 5000,
      lang: "en",
      states: [target()],
      rep: rep({ asymmetry: null, fix: "" }),
      repCount: 1,
    });
    expect(spoken).not.toMatch(/even out both sides/i);
  });

  it("does call it out when both sides were actually seen", () => {
    const voice = coach();
    // The fix line outranks it, so this rep carries none.
    const spoken = voice.tick({
      now: 5000,
      lang: "en",
      states: [target()],
      rep: rep({ asymmetry: 20, fix: "", down: 1.4, up: 1.1 }),
      repCount: 1,
    });
    expect(spoken).toMatch(/even out both sides/i);
  });

  it("keeps silent inside the gap between two lines", () => {
    const voice = coach();
    expect(voice.tick({ now: 5000, lang: "en", states: [target()], rep: rep(), repCount: 1 })).toBe(
      "1",
    );
    expect(
      voice.tick({
        now: 5100,
        lang: "en",
        states: [target()],
        rep: rep({ index: 2 }),
        repCount: 2,
      }),
    ).toBeNull();
  });

  it("speaks the technique fix ahead of the rep count", () => {
    const voice = coach();
    const spoken = voice.tick({
      now: 5000,
      lang: "en",
      states: [target()],
      rep: rep({ fix: "Chest dropping — lift chest" }),
      repCount: 2,
    });
    expect(spoken).toBe("Chest dropping — lift chest");
  });
});
