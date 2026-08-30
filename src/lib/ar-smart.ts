import { LM, angleAt, AR_EXERCISES, evaluateTargets, type ArExercise, type Point } from "./ar-angles";

export type Base = "lt" | "en";

/* ------------------------------------------------------------------ */
/* Automatic exercise recognition                                      */
/* ------------------------------------------------------------------ */

export type PoseSample = { pose: Point[]; t: number };

const midY = (pose: Point[], a: number, b: number) => ((pose[a]?.y ?? 0) + (pose[b]?.y ?? 0)) / 2;
const midX = (pose: Point[], a: number, b: number) => ((pose[a]?.x ?? 0) + (pose[b]?.x ?? 0)) / 2;

const range = (list: number[]) => (list.length ? Math.max(...list) - Math.min(...list) : 0);
const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

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

const complete = (p: Point[]) =>
  [LM.rShoulder, LM.rHip, LM.rKnee, LM.rAnkle, LM.rElbow, LM.rWrist].every((i) => p[i]);

/**
 * Guesses which of the tracked exercises the athlete is doing from a short
 * window of pose samples. Returns null while the signal is ambiguous.
 */
export function detectExercise(samples: PoseSample[]): string | null {
  const usable = samples.filter((s) => complete(s.pose));
  if (usable.length < 12) return null;
  const poses = usable.map((s) => s.pose);

  const shoulderY = poses.map((p) => midY(p, LM.lShoulder, LM.rShoulder));
  const hipY = poses.map((p) => midY(p, LM.lHip, LM.rHip));
  const shoulderX = poses.map((p) => midX(p, LM.lShoulder, LM.rShoulder));
  const hipX = poses.map((p) => midX(p, LM.lHip, LM.rHip));

  const vertical = mean(hipY.map((y, i) => y - shoulderY[i]!));
  const horizontal = Math.abs(mean(hipX.map((x, i) => x - shoulderX[i]!)));
  const lying = vertical < horizontal * 0.9;

  const knees = poses.map((p) => kneeAngle(p, "r"));
  const elbows = poses.map((p) => elbowAngle(p, "r"));
  const hips = poses.map((p) => hipAngle(p, "r"));
  const wristAboveShoulder = mean(
    poses.map((p) => ((p[LM.rWrist]?.y ?? 1) < (p[LM.rShoulder]?.y ?? 0) ? 1 : 0)),
  );

  if (lying) {
    // horizontal body: push-up when elbows travel, plank when everything is still
    if (range(elbows) > 25) return "pushup";
    if (range(hips) < 12 && range(elbows) < 18) return "plank";
    return "pushup";
  }

  if (wristAboveShoulder > 0.5 && range(elbows) > 25) return "overhead-press";

  const ankleGap = mean(
    poses.map((p) => Math.abs((p[LM.lAnkle]?.x ?? 0) - (p[LM.rAnkle]?.x ?? 0))),
  );
  const shoulderWidth = mean(
    poses.map((p) => Math.abs((p[LM.lShoulder]?.x ?? 0) - (p[LM.rShoulder]?.x ?? 0))) ,
  );

  if (range(knees) > 22) {
    if (ankleGap > Math.max(0.09, shoulderWidth * 1.6)) return "lunge";
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
  /** left vs right difference in degrees at the bottom (0 = perfect) */
  asymmetry: number;
  /** dominant cue during this rep, empty when clean */
  fix: string;
};

const SYM_JOINTS: Record<string, (p: Point[], s: "l" | "r") => number> = {
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
  private asym = 0;
  private cues = new Map<string, number>();
  reps: RepRecord[] = [];

  constructor(private exercise: ArExercise) {}

  reset(exercise?: ArExercise) {
    if (exercise) this.exercise = exercise;
    this.phase = "up";
    this.frames = 0;
    this.okFrames = 0;
    this.bottom = 999;
    this.asym = 0;
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
    if (!a || !b || !c) return null;
    const angle = angleAt(a, b, c);

    const states = evaluateTargets(pose, ex, lang);
    const bad = states.filter((s) => s.status !== "ok");
    if (this.phase === "down") {
      this.frames++;
      if (!bad.length) this.okFrames++;
      for (const s of bad) this.cues.set(s.cue, (this.cues.get(s.cue) ?? 0) + 1);
      if (angle < this.bottom) {
        this.bottom = angle;
        this.bottomAt = now;
        const sym = SYM_JOINTS[ex.slug];
        if (sym && complete(pose) && pose[LM.lKnee] && pose[LM.lElbow]) {
          this.asym = Math.abs(sym(pose, "l") - sym(pose, "r"));
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
      this.asym = 0;
      this.cues.clear();
      return null;
    }

    if (this.phase === "down" && angle > ex.repUp) {
      this.phase = "up";
      const down = Math.max(0.1, (this.bottomAt - this.startedAt) / 1000);
      const up = Math.max(0.1, (now - this.bottomAt) / 1000);
      const cleanliness = this.frames ? this.okFrames / this.frames : 0;
      const tempoPenalty = down + up < 1 ? 12 : 0;
      const asymPenalty = Math.min(20, Math.max(0, this.asym - 8));
      const score = Math.round(
        Math.max(0, Math.min(100, cleanliness * 100 - tempoPenalty - asymPenalty)),
      );
      let fix = "";
      let top = 0;
      for (const [cue, count] of this.cues) if (count > top) ((top = count), (fix = cue));
      const rep: RepRecord = {
        index: this.reps.length + 1,
        score,
        down: Math.round(down * 10) / 10,
        up: Math.round(up * 10) / 10,
        bottomAngle: Math.round(this.bottom),
        asymmetry: Math.round(this.asym),
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
  asymmetry: number;
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
  const asym = Math.round(mean(reps.map((r) => r.asymmetry)));

  const counts = new Map<string, number>();
  for (const r of reps) if (r.fix) counts.set(r.fix, (counts.get(r.fix) ?? 0) + 1);
  let fix = "";
  let top = 0;
  for (const [cue, count] of counts) if (count > top) ((top = count), (fix = cue));
  if (!fix && down < 1) fix = T.fast;
  if (!fix && asym > 10) fix = T.asym;

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
