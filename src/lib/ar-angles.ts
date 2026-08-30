export type Point = { x: number; y: number; visibility?: number };

export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const;

export const SKELETON: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

/** Angle in degrees at point b formed by a-b-c. */
export function angleAt(a: Point, b: Point, c: Point): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

export type JointTarget = {
  id: string;
  label: { lt: string; en: string };
  /** landmark triple [a, vertex, c] */
  joints: [number, number, number];
  /** acceptable range at the tracked position */
  min: number;
  max: number;
  /** cue shown when angle is below min / above max */
  low: { lt: string; en: string };
  high: { lt: string; en: string };
};

export type ArExercise = {
  slug: string;
  name: { lt: string; en: string };
  /** joint used for rep counting */
  repJoint: [number, number, number];
  /** angle below this = bottom of the rep */
  repDown: number;
  /** angle above this = lockout */
  repUp: number;
  targets: JointTarget[];
};

export const AR_EXERCISES: ArExercise[] = [
  {
    slug: "squat",
    name: { lt: "Pritūpimas", en: "Squat" },
    repJoint: [LM.rHip, LM.rKnee, LM.rAnkle],
    repDown: 100,
    repUp: 160,
    targets: [
      {
        id: "knee",
        label: { lt: "Kelio kampas", en: "Knee angle" },
        joints: [LM.rHip, LM.rKnee, LM.rAnkle],
        min: 70,
        max: 100,
        low: { lt: "Per giliai — kelkis aukščiau", en: "Too deep — come up" },
        high: { lt: "Leiskis žemiau", en: "Go deeper" },
      },
      {
        id: "torso",
        label: { lt: "Liemens kampas", en: "Torso angle" },
        joints: [LM.rShoulder, LM.rHip, LM.rKnee],
        min: 70,
        max: 120,
        low: { lt: "Krūtinė krenta — kelk krūtinę", en: "Chest dropping — lift chest" },
        high: { lt: "Atsisėsk į klubus", en: "Sit back into the hips" },
      },
    ],
  },
  {
    slug: "pushup",
    name: { lt: "Atsispaudimas", en: "Push-up" },
    repJoint: [LM.rShoulder, LM.rElbow, LM.rWrist],
    repDown: 95,
    repUp: 160,
    targets: [
      {
        id: "elbow",
        label: { lt: "Alkūnės kampas", en: "Elbow angle" },
        joints: [LM.rShoulder, LM.rElbow, LM.rWrist],
        min: 70,
        max: 100,
        low: { lt: "Per žemai — spausk aukštyn", en: "Too low — press up" },
        high: { lt: "Leiskis žemiau", en: "Lower further" },
      },
      {
        id: "hip",
        label: { lt: "Klubų linija", en: "Hip line" },
        joints: [LM.rShoulder, LM.rHip, LM.rKnee],
        min: 165,
        max: 185,
        low: { lt: "Klubai krenta — įtempk pilvą", en: "Hips sagging — brace your core" },
        high: { lt: "Nukelk klubus žemyn", en: "Lower your hips" },
      },
    ],
  },
  {
    slug: "plank",
    name: { lt: "Lenta", en: "Plank" },
    repJoint: [LM.rShoulder, LM.rHip, LM.rKnee],
    repDown: 100,
    repUp: 200,
    targets: [
      {
        id: "hip",
        label: { lt: "Kūno linija", en: "Body line" },
        joints: [LM.rShoulder, LM.rHip, LM.rKnee],
        min: 168,
        max: 186,
        low: { lt: "Klubai per žemai", en: "Hips too low" },
        high: { lt: "Klubai per aukštai", en: "Hips too high" },
      },
    ],
  },
  {
    slug: "deadlift",
    name: { lt: "Mirties trauka", en: "Deadlift" },
    repJoint: [LM.rShoulder, LM.rHip, LM.rKnee],
    repDown: 100,
    repUp: 165,
    targets: [
      {
        id: "hip",
        label: { lt: "Klubų kampas", en: "Hip angle" },
        joints: [LM.rShoulder, LM.rHip, LM.rKnee],
        min: 60,
        max: 180,
        low: { lt: "Nugara apvali — ištiesk krūtinę", en: "Back rounding — open the chest" },
        high: { lt: "Užfiksuok klubus", en: "Lock out the hips" },
      },
      {
        id: "knee",
        label: { lt: "Kelio kampas", en: "Knee angle" },
        joints: [LM.rHip, LM.rKnee, LM.rAnkle],
        min: 120,
        max: 180,
        low: { lt: "Per daug tupi — tai ne pritūpimas", en: "Too squatty — hinge instead" },
        high: { lt: "Truputį sulenk kelius", en: "Soften the knees" },
      },
    ],
  },
  {
    slug: "lunge",
    name: { lt: "Išpuolis", en: "Lunge" },
    repJoint: [LM.rHip, LM.rKnee, LM.rAnkle],
    repDown: 100,
    repUp: 160,
    targets: [
      {
        id: "knee",
        label: { lt: "Priekinis kelias", en: "Front knee" },
        joints: [LM.rHip, LM.rKnee, LM.rAnkle],
        min: 80,
        max: 100,
        low: { lt: "Kelias per toli priekyje", en: "Knee travelling too far forward" },
        high: { lt: "Leiskis iki 90°", en: "Lower to 90°" },
      },
      {
        id: "torso",
        label: { lt: "Liemuo", en: "Torso" },
        joints: [LM.rShoulder, LM.rHip, LM.rKnee],
        min: 150,
        max: 185,
        low: { lt: "Palinkai į priekį — stiebkis", en: "Leaning forward — stand tall" },
        high: { lt: "Nesilenk atgal", en: "Don't lean back" },
      },
    ],
  },
  {
    slug: "overhead-press",
    name: { lt: "Spaudimas virš galvos", en: "Overhead press" },
    repJoint: [LM.rShoulder, LM.rElbow, LM.rWrist],
    repDown: 100,
    repUp: 165,
    targets: [
      {
        id: "elbow",
        label: { lt: "Alkūnės kampas", en: "Elbow angle" },
        joints: [LM.rShoulder, LM.rElbow, LM.rWrist],
        min: 85,
        max: 180,
        low: { lt: "Per žemai — nuleisk iki smakro", en: "Too low — stop at chin" },
        high: { lt: "Užfiksuok viršuje", en: "Lock out at the top" },
      },
    ],
  },
];

export type TargetState = {
  id: string;
  label: string;
  angle: number;
  min: number;
  max: number;
  status: "ok" | "low" | "high";
  cue: string;
  vertex: Point;
};

export function evaluateTargets(
  landmarks: Point[],
  exercise: ArExercise,
  lang: "lt" | "en",
): TargetState[] {
  return exercise.targets.map((target) => {
    const [ai, bi, ci] = target.joints;
    const a = landmarks[ai]!;
    const b = landmarks[bi]!;
    const c = landmarks[ci]!;
    const angle = Math.round(angleAt(a, b, c));
    const status = angle < target.min ? "low" : angle > target.max ? "high" : "ok";
    return {
      id: target.id,
      label: target.label[lang],
      angle,
      min: target.min,
      max: target.max,
      status,
      cue: status === "low" ? target.low[lang] : status === "high" ? target.high[lang] : "",
      vertex: b,
    };
  });
}
