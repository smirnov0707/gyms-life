import {
  LM,
  angleAt,
  AR_EXERCISES,
  evaluateTargets,
  landmarkVisible,
  type ArExercise,
  type Point,
} from "./ar-angles";

export type Base = "lt" | "en";

/* ------------------------------------------------------------------ */
/* Automatic exercise recognition                                      */
/* ------------------------------------------------------------------ */

export type PoseSample = { pose: Point[]; t: number };

/**
 * The midpoint of two landmarks along one axis, or the one that is visible,
 * or null when neither is.
 *
 * These used to read `pose[a]?.y ?? 0`, which guards against a landmark the
 * model left out — and the model never leaves one out. It returns all of them,
 * every frame, each with a confidence score, so what actually arrived was a
 * coordinate the model had no confidence in, used as though it were measured.
 *
 * That matters here more than it looks: every angle this module measures is a
 * right-side angle, so it expects a right-side-on camera — the view in which
 * the athlete's left shoulder, hip and ankle are precisely the ones behind
 * their body. The frame-completeness gate below only ever checked the right
 * side, so the far half of every reading was a guess.
 */
const midOf = (pose: Point[], a: number, b: number, axis: "x" | "y"): number | null => {
  const first = pose[a];
  const second = pose[b];
  const left = landmarkVisible(first) ? first[axis] : null;
  const right = landmarkVisible(second) ? second[axis] : null;
  if (left !== null && right !== null) return (left + right) / 2;
  return left ?? right;
};

/**
 * The distance between two landmarks along one axis, or null when either is
 * missing.
 *
 * No one-sided fallback, because there is no one-sided answer. A span is the
 * one measurement that cannot be salvaged from a single side, and it was the
 * one carrying the most weight: the gap between the feet is the entire
 * evidence for calling a movement a lunge rather than a squat, and it was
 * being read off an ankle the model had guessed at.
 */
const spanOf = (pose: Point[], a: number, b: number, axis: "x" | "y"): number | null => {
  const first = pose[a];
  const second = pose[b];
  if (!landmarkVisible(first) || !landmarkVisible(second)) return null;
  return Math.abs(first[axis] - second[axis]);
};

const range = (list: number[]) => (list.length ? Math.max(...list) - Math.min(...list) : 0);
const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

/** The frames where the joint could actually be measured. */
const measured = (list: (number | null)[]) => list.filter((v): v is number => v !== null);

/** How many frames of a window have to carry a measurement for it to count. */
const enough = (poses: Point[][]) => poses.length / 2;

const kneeAngle = (p: Point[], side: "l" | "r") =>
  side === "r"
    ? angleAt(p[LM.rHip]!, p[LM.rKnee]!, p[LM.rAnkle]!)
    : angleAt(p[LM.lHip]!, p[LM.lKnee]!, p[LM.lAnkle]!);

const elbowAngle = (p: Point[], side: "l" | "r") =>
  side === "r"
    ? angleAt(p[LM.rShoulder]!, p[LM.rElbow]!, p[LM.rWrist]!)
    : angleAt(p[LM.lShoulder]!, p[LM.lElbow]!, p[LM.lWrist]!);

const hipAngle = (p: Point[], side: "l" | "r") =>
  side === "r"
    ? angleAt(p[LM.rShoulder]!, p[LM.rHip]!, p[LM.rKnee]!)
    : angleAt(p[LM.lShoulder]!, p[LM.lHip]!, p[LM.lKnee]!);

// Visible, not merely present. A landmark the model returns with low
// confidence is a guess about where a joint might be, and a whole exercise
// used to be recognised from a frame made of them.
const complete = (p: Point[]) =>
  [LM.rShoulder, LM.rHip, LM.rKnee, LM.rAnkle, LM.rElbow, LM.rWrist].every((i) =>
    landmarkVisible(p[i]),
  );

/**
 * Guesses which of the tracked exercises the athlete is doing from a short
 * window of pose samples. Returns null while the signal is ambiguous.
 */
export function detectExercise(samples: PoseSample[]): string | null {
  const usable = samples.filter((s) => complete(s.pose));
  if (usable.length < 12) return null;
  const poses = usable.map((s) => s.pose);

  // Shoulder and hip positions, from both sides when both are visible and from
  // the right side alone otherwise — which `complete` guarantees. Whether the
  // body is lying down is a question about the line from shoulder to hip, and
  // one visible side answers it as well as two.
  const trunk = poses.flatMap((p) => {
    const shoulderY = midOf(p, LM.lShoulder, LM.rShoulder, "y");
    const hipY = midOf(p, LM.lHip, LM.rHip, "y");
    const shoulderX = midOf(p, LM.lShoulder, LM.rShoulder, "x");
    const hipX = midOf(p, LM.lHip, LM.rHip, "x");
    if (shoulderY === null || hipY === null || shoulderX === null || hipX === null) return [];
    return [{ vertical: hipY - shoulderY, horizontal: hipX - shoulderX }];
  });
  if (trunk.length < enough(poses)) return null;

  const vertical = mean(trunk.map((frame) => frame.vertical));
  const horizontal = Math.abs(mean(trunk.map((frame) => frame.horizontal)));
  const lying = vertical < horizontal * 0.9;

  const knees = measured(poses.map((p) => kneeAngle(p, "r")));
  const elbows = measured(poses.map((p) => elbowAngle(p, "r")));
  const hips = measured(poses.map((p) => hipAngle(p, "r")));
  // Every branch below reads these three series, and `range` and `mean` of an
  // empty list are both zero — which would quietly satisfy the "everything is
  // still" test and report a plank. Ambiguous is the honest answer.
  if (
    knees.length < enough(poses) ||
    elbows.length < enough(poses) ||
    hips.length < enough(poses)
  ) {
    return null;
  }
  // Both of these landmarks are on the right side, which `complete` has already
  // established is visible in every frame here.
  const wristAboveShoulder = mean(poses.map((p) => (p[LM.rWrist]!.y < p[LM.rShoulder]!.y ? 1 : 0)));

  if (lying) {
    // horizontal body: push-up when elbows travel, plank when everything is still
    if (range(elbows) > 25) return "pushup";
    if (range(hips) < 12 && range(elbows) < 18) return "plank";
    return "pushup";
  }

  if (wristAboveShoulder > 0.5 && range(elbows) > 25) return "overhead-press";

  // Both of these are distances between the two sides of the body, so both are
  // unavailable from a side-on view — and a side-on view is what this module
  // is filmed from.
  const ankleGaps = poses
    .map((p) => spanOf(p, LM.lAnkle, LM.rAnkle, "x"))
    .filter((value): value is number => value !== null);
  const shoulderWidths = poses
    .map((p) => spanOf(p, LM.lShoulder, LM.rShoulder, "x"))
    .filter((value): value is number => value !== null);

  if (range(knees) > 22) {
    // A lunge is a squat with the feet split, so the split is the whole
    // evidence for calling it one. Without both ankles and both shoulders in
    // view there is no split to measure, and the knee travel on its own says
    // squat — which is the claim the evidence actually supports.
    const splitMeasurable =
      ankleGaps.length >= enough(poses) && shoulderWidths.length >= enough(poses);
    if (splitMeasurable && mean(ankleGaps) > Math.max(0.09, mean(shoulderWidths) * 1.6)) {
      return "lunge";
    }
    return "squat";
  }

  // hips move a lot while knees stay fairly straight = hip hinge
  if (range(hips) > 22 && mean(knees) > 140) return "deadlift";

  if (range(hips) < 10 && mean(hips) > 155) return "plank";
  return null;
}

/* ------------------------------------------------------------------ */
/* Rep quality, tempo, symmetry                                        */
/* ------------------------------------------------------------------ */

export type RepRecord = {
  index: number;
  score: number;
  /** seconds of the lowering phase */
  down: number;
  /** seconds of the lifting phase */
  up: number;
  /** peak depth angle reached at the bottom */
  bottomAngle: number;
  /**
   * Left vs right difference in degrees at the bottom, or null when both
   * sides were never visible at once.
   *
   * Zero means the two sides matched. It used to mean that *and* "the camera
   * only ever saw one side", which is the normal case when filming a squat
   * side-on — so a rep nobody could compare came back as perfectly
   * symmetrical.
   */
  asymmetry: number | null;
  /** dominant cue during this rep, empty when clean */
  fix: string;
};

const SYM_JOINTS: Record<string, (p: Point[], s: "l" | "r") => number | null> = {
  squat: kneeAngle,
  lunge: kneeAngle,
  pushup: elbowAngle,
  "overhead-press": elbowAngle,
  deadlift: hipAngle,
  plank: hipAngle,
};

/**
 * Stateful per-rep analyser: feed it every frame, it emits a scored rep
 * whenever a full repetition completes.
 */
export class RepAnalyser {
  private phase: "up" | "down" = "up";
  private startedAt = 0;
  private bottomAt = 0;
  private okFrames = 0;
  private frames = 0;
  private bottom = 999;
  /** Null until a frame showed both sides at once. */
  private asym: number | null = null;
  private cues = new Map<string, number>();
  reps: RepRecord[] = [];

  constructor(private exercise: ArExercise) {}

  reset(exercise?: ArExercise) {
    if (exercise) this.exercise = exercise;
    this.phase = "up";
    this.frames = 0;
    this.okFrames = 0;
    this.bottom = 999;
    this.asym = null;
    this.cues.clear();
    this.reps = [];
  }

  /** @returns the completed rep, when this frame closed one */
  push(pose: Point[], lang: Base, now: number): RepRecord | null {
    const ex = this.exercise;
    const [ri, rj, rk] = ex.repJoint;
    const a = pose[ri];
    const b = pose[rj];
    const c = pose[rk];
    // Visible, not merely present: the rep phase turns on this angle, so a
    // landmark the model is guessing at would start and close reps that never
    // happened.
    if (!landmarkVisible(a) || !landmarkVisible(b) || !landmarkVisible(c)) return null;
    const angle = angleAt(a, b, c);
    if (angle === null) return null;

    const states = evaluateTargets(pose, ex, lang);
    const bad = states.filter((s) => s.status !== "ok");
    if (this.phase === "down") {
      // A frame counts towards cleanliness only when something was actually
      // measured on it: an empty list of faults must never read as a flawless
      // frame. Defensive today — every exercise's rep joint is also one of its
      // form targets, so a frame that got this far has at least one measured
      // target — but the two lists are defined separately and nothing keeps
      // them in step.
      if (states.length) {
        this.frames++;
        if (!bad.length) this.okFrames++;
      }
      for (const s of bad) this.cues.set(s.cue, (this.cues.get(s.cue) ?? 0) + 1);
      if (angle < this.bottom) {
        this.bottom = angle;
        this.bottomAt = now;
        const sym = SYM_JOINTS[ex.slug];
        if (
          sym &&
          complete(pose) &&
          landmarkVisible(pose[LM.lKnee]) &&
          landmarkVisible(pose[LM.lElbow])
        ) {
          const left = sym(pose, "l");
          const right = sym(pose, "r");
          // Asymmetry is a claim about both sides. One measurable side is not
          // half a claim, it is none.
          if (left !== null && right !== null) this.asym = Math.abs(left - right);
        }
      }
    }

    if (this.phase === "up" && angle < ex.repDown) {
      this.phase = "down";
      this.startedAt = now;
      this.bottomAt = now;
      this.bottom = angle;
      this.frames = 0;
      this.okFrames = 0;
      this.asym = null;
      this.cues.clear();
      return null;
    }

    if (this.phase === "down" && angle > ex.repUp) {
      this.phase = "up";
      const down = Math.max(0.1, (this.bottomAt - this.startedAt) / 1000);
      const up = Math.max(0.1, (now - this.bottomAt) / 1000);
      const cleanliness = this.frames ? this.okFrames / this.frames : 0;
      const tempoPenalty = down + up < 1 ? 12 : 0;
      // Nothing measured is nothing to penalise. A rep filmed from one side
      // is not a symmetrical rep, but it is not a lopsided one either.
      const asymPenalty = this.asym === null ? 0 : Math.min(20, Math.max(0, this.asym - 8));
      const score = Math.round(
        Math.max(0, Math.min(100, cleanliness * 100 - tempoPenalty - asymPenalty)),
      );
      let fix = "";
      let top = 0;
      for (const [cue, count] of this.cues) {
        if (count > top) {
          top = count;
          fix = cue;
        }
      }
      const rep: RepRecord = {
        index: this.reps.length + 1,
        score,
        down: Math.round(down * 10) / 10,
        up: Math.round(up * 10) / 10,
        bottomAngle: Math.round(this.bottom),
        asymmetry: this.asym === null ? null : Math.round(this.asym),
        fix: score >= 90 ? "" : fix,
      };
      this.reps.push(rep);
      return rep;
    }
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Set summary                                                         */
/* ------------------------------------------------------------------ */

export type SetSummary = {
  reps: number;
  score: number;
  tempo: string;
  /** Null when not one rep in the set had both sides visible at once. */
  asymmetry: number | null;
  headline: string;
  fix: string;
  praise: string;
};

const TXT = {
  lt: {
    excellent: "Puiki serija — technika švari nuo pirmo iki paskutinio pakartojimo.",
    good: "Gera serija. Dar truputis dėmesio detalėms ir bus tobula.",
    mixed: "Serija atlikta, bet technika plaukė. Sumažink svorį ir sulėtink judesį.",
    fast: "Judesys per greitas — leiskis bent 2 sekundes.",
    asym: "Kairė ir dešinė pusė dirba nevienodai — patikrink pusiausvyrą.",
    steady: "Tempas stabilus, pusiausvyra tvarkinga.",
    keep: "Laikykis to paties tempo kitoje serijoje.",
  },
  en: {
    excellent: "Excellent set — clean technique from the first rep to the last.",
    good: "Solid set. A little more attention to detail and it is perfect.",
    mixed: "Set completed, but form drifted. Drop the load and slow the movement down.",
    fast: "Movement is too fast — take at least 2 seconds on the way down.",
    asym: "Left and right sides are working unevenly — check your balance.",
    steady: "Tempo is steady and balance looks tidy.",
    keep: "Keep the same tempo on the next set.",
  },
} as const;

export function summarizeSet(reps: RepRecord[], lang: Base): SetSummary | null {
  if (!reps.length) return null;
  const T = TXT[lang];
  const score = Math.round(mean(reps.map((r) => r.score)));
  const down = mean(reps.map((r) => r.down));
  const up = mean(reps.map((r) => r.up));
  // Only the reps where both sides were actually seen. Averaging an
  // unmeasured rep in as zero would report a set as symmetrical on the
  // strength of the camera angle.
  const asyms = reps.map((r) => r.asymmetry).filter((value): value is number => value !== null);
  const asym = asyms.length ? Math.round(mean(asyms)) : null;

  const counts = new Map<string, number>();
  for (const r of reps) if (r.fix) counts.set(r.fix, (counts.get(r.fix) ?? 0) + 1);
  let fix = "";
  let top = 0;
  for (const [cue, count] of counts) {
    if (count > top) {
      top = count;
      fix = cue;
    }
  }
  if (!fix && down < 1) fix = T.fast;
  if (!fix && asym !== null && asym > 10) fix = T.asym;

  return {
    reps: reps.length,
    score,
    tempo: `${down.toFixed(1)}s / ${up.toFixed(1)}s`,
    asymmetry: asym,
    headline: score >= 88 ? T.excellent : score >= 70 ? T.good : T.mixed,
    fix,
    praise: fix ? T.keep : T.steady,
  };
}

export const AR_TXT = {
  lt: {
    detecting: "Ieškau judesio…",
    detected: (name: string) => `Atpažinta: ${name}`,
    autoCal: "Kalibruoju — stovėk ramiai",
    calDone: "Paruošta",
    manual: "Rankinis pasirinkimas",
    auto: "Automatinis",
    settings: "Daugiau nustatymų",
    quality: "Pakartojimo kokybė",
    tempo: "Tempas (žemyn / aukštyn)",
    symmetry: "Simetrija",
    lastRep: "Paskutinis pakartojimas",
    finish: "Baigti seriją",
    summary: "Serijos santrauka",
    again: "Nauja serija",
    ready: "Pasiruošk — stok visu ūgiu kadre",
  },
  en: {
    detecting: "Looking for the movement…",
    detected: (name: string) => `Detected: ${name}`,
    autoCal: "Calibrating — stand still",
    calDone: "Ready",
    manual: "Manual choice",
    auto: "Automatic",
    settings: "More settings",
    quality: "Rep quality",
    tempo: "Tempo (down / up)",
    symmetry: "Symmetry",
    lastRep: "Last rep",
    finish: "Finish set",
    summary: "Set summary",
    again: "New set",
    ready: "Get ready — stand full height in frame",
  },
} as const;

export const exerciseName = (slug: string, lang: Base) =>
  AR_EXERCISES.find((e) => e.slug === slug)?.name[lang] ?? slug;
