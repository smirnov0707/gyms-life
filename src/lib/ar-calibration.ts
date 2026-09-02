import { tr, type Lang } from "./i18n";
import { LM, type Point } from "./ar-angles";

export type CalibFrame = { pose: Point[]; w: number; h: number };

export type CalibStepId = "stand" | "move" | "scale";

export type CalibStepResult = {
  id: CalibStepId;
  /** 0-100 quality of this step. */
  quality: number;
  metrics: { label: string; value: string; ok: boolean }[];
  /** cm per pixel derived in this step, when measurable */
  cmPerPx?: number | undefined;
  standingHipY?: number | undefined;
};

export type Reliability = {
  score: number;
  level: "high" | "medium" | "low";
  label: string;
  note: string;
  tips: string[];
  cmPerPx: number | null;
  standingHipY: number | null;
};

export function calibSteps(lang: Lang): {
  id: CalibStepId;
  seconds: number;
  title: string;
  instruction: string;
}[] {
  return [
    {
      id: "stand",
      seconds: 5,
      title: tr(lang, "ar.calib.stand.title"),
      instruction: tr(lang, "ar.calib.stand.instruction"),
    },
    {
      id: "scale",
      seconds: 5,
      title: tr(lang, "ar.calib.scale.title"),
      instruction: tr(lang, "ar.calib.scale.instruction"),
    },
    {
      id: "move",
      seconds: 8,
      title: tr(lang, "ar.calib.move.title"),
      instruction: tr(lang, "ar.calib.move.instruction"),
    },
  ];
}

const KEY_LANDMARKS = [
  LM.nose,
  LM.lShoulder,
  LM.rShoulder,
  LM.lHip,
  LM.rHip,
  LM.lKnee,
  LM.rKnee,
  LM.lAnkle,
  LM.rAnkle,
];

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const r = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const visibilityOf = (f: CalibFrame) =>
  avg(KEY_LANDMARKS.map((i) => f.pose[i]?.visibility ?? (f.pose[i] ? 0.9 : 0)));

const bodyPx = (f: CalibFrame) => {
  const nose = f.pose[LM.nose];
  const ankles = [f.pose[LM.lAnkle], f.pose[LM.rAnkle]].filter(Boolean) as Point[];
  if (!nose || !ankles.length) return 0;
  return (avg(ankles.map((p) => p.y)) - nose.y) * f.h;
};

const hipPx = (f: CalibFrame) => {
  const hips = [f.pose[LM.lHip], f.pose[LM.rHip]].filter(Boolean) as Point[];
  return hips.length ? avg(hips.map((p) => p.y)) * f.h : 0;
};

/** Scores a single calibration step from the frames captured during it. */
export function evaluateStep(
  id: CalibStepId,
  frames: CalibFrame[],
  heightCm: number,
  lang: Lang,
): CalibStepResult {
  const T = {
    vis: tr(lang, "ar.metric.vis"),
    steady: tr(lang, "ar.metric.steady"),
    frame: tr(lang, "ar.metric.frame"),
    scale: tr(lang, "ar.metric.scale"),
    track: tr(lang, "ar.metric.track"),
    depth: tr(lang, "ar.metric.depth"),
  };
  if (frames.length < 5) {
    return {
      id,
      quality: 0,
      metrics: [{ label: T.vis, value: tr(lang, "ar.noData"), ok: false }],
    };
  }

  const vis = avg(frames.map(visibilityOf));
  const visScore = clamp((vis - 0.4) / 0.5) * 100;

  if (id === "stand") {
    const heights = frames.map(bodyPx).filter((n) => n > 0);
    const hips = frames.map(hipPx).filter((n) => n > 0);
    const meanH = avg(heights);
    const jitter = avg(hips.map((y) => Math.abs(y - avg(hips))));
    const steadyScore = clamp(1 - jitter / Math.max(1, meanH * 0.03)) * 100;
    const coverage = meanH / (frames[0]!.h || 1);
    const frameScore = clamp((coverage - 0.35) / 0.35) * 100;
    const quality = visScore * 0.4 + steadyScore * 0.3 + frameScore * 0.3;
    return {
      id,
      quality,
      cmPerPx: meanH > 40 ? (heightCm * 0.93) / meanH : undefined,
      standingHipY: hips.length ? avg(hips) : undefined,
      metrics: [
        { label: T.vis, value: `${Math.round(vis * 100)} %`, ok: vis > 0.7 },
        { label: T.steady, value: `±${r(jitter)} px`, ok: steadyScore > 60 },
        { label: T.frame, value: `${Math.round(coverage * 100)} %`, ok: frameScore > 60 },
      ],
    };
  }

  if (id === "scale") {
    const spans = frames
      .map((f) => {
        const lw = f.pose[LM.lWrist];
        const rw = f.pose[LM.rWrist];
        if (!lw || !rw) return 0;
        return Math.hypot((lw.x - rw.x) * f.w, (lw.y - rw.y) * f.h);
      })
      .filter((n) => n > 0);
    const heights = frames.map(bodyPx).filter((n) => n > 0);
    const ratio = heights.length && spans.length ? avg(spans) / (avg(heights) / 0.93) : 0;
    // healthy wingspan ≈ height (ratio 0.95-1.06)
    const scaleScore = clamp(1 - Math.abs(ratio - 1) / 0.25) * 100;
    const quality = visScore * 0.4 + scaleScore * 0.6;
    return {
      id,
      quality,
      metrics: [
        { label: T.vis, value: `${Math.round(vis * 100)} %`, ok: vis > 0.7 },
        { label: T.scale, value: ratio ? `${r(ratio, 2)}×` : "—", ok: scaleScore > 60 },
      ],
    };
  }

  const hips = frames.map(hipPx).filter((n) => n > 0);
  const heights = frames.map(bodyPx).filter((n) => n > 0);
  const range = hips.length ? Math.max(...hips) - Math.min(...hips) : 0;
  const rel = range / Math.max(1, avg(heights));
  const rangeScore = clamp(rel / 0.12) * 100;
  const dropped = frames.filter((f) => visibilityOf(f) < 0.5).length / frames.length;
  const trackScore = clamp(1 - dropped / 0.3) * 100;
  const quality = visScore * 0.25 + trackScore * 0.4 + rangeScore * 0.35;
  const cmPerPx = heights.length > 0 ? (heightCm * 0.93) / avg(heights) : undefined;
  return {
    id,
    quality,
    ...(cmPerPx ? { cmPerPx } : {}),
    metrics: [
      { label: T.track, value: `${Math.round((1 - dropped) * 100)} %`, ok: trackScore > 60 },
      {
        label: T.depth,
        value: cmPerPx ? `${Math.round(range * cmPerPx)} cm` : `${Math.round(range)} px`,
        ok: rangeScore > 50,
      },
    ],
  };
}

/** Combines the three step results into a single measurement reliability rating. */
export function computeReliability(results: CalibStepResult[], lang: Lang): Reliability {
  const weight: Record<CalibStepId, number> = { stand: 0.4, scale: 0.25, move: 0.35 };
  const score = Math.round(
    results.reduce((sum, res) => sum + res.quality * weight[res.id], 0) /
      Math.max(
        0.001,
        results.reduce((sum, res) => sum + weight[res.id], 0),
      ),
  );

  const level = score >= 80 ? "high" : score >= 60 ? "medium" : "low";
  const stand = results.find((s) => s.id === "stand");
  const scale = results.find((s) => s.id === "scale");
  const move = results.find((s) => s.id === "move");

  const tips: string[] = [];
  if ((stand?.quality ?? 100) < 75) tips.push(tr(lang, "ar.tip.stand"));
  if ((scale?.quality ?? 100) < 70) tips.push(tr(lang, "ar.tip.scale"));
  if ((move?.quality ?? 100) < 70) tips.push(tr(lang, "ar.tip.move"));
  if (!tips.length) tips.push(tr(lang, "ar.tip.ok"));

  const note =
    level === "high"
      ? tr(lang, "ar.note.high")
      : level === "medium"
        ? tr(lang, "ar.note.medium")
        : tr(lang, "ar.note.low");

  const cmSource = stand?.cmPerPx ?? move?.cmPerPx ?? null;

  return {
    score,
    level,
    label:
      level === "high"
        ? tr(lang, "ar.reliability.high")
        : level === "medium"
          ? tr(lang, "ar.reliability.medium")
          : tr(lang, "ar.reliability.low"),
    note,
    tips,
    cmPerPx: cmSource,
    standingHipY: stand?.standingHipY ?? null,
  };
}
