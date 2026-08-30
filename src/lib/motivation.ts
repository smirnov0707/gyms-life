import { tr, type Lang, type TKey } from "@/lib/i18n";

export type LoadBucket = "high" | "normal" | "low";

export type DailyMotivation = {
  headline: string;
  body: string;
  focus: string;
  bucket: LoadBucket;
  loadPct: number;
};

const HEAD_KEYS: Record<string, string[]> = {
  lose_fat: ["hw.mot.head.lose_fat.1", "hw.mot.head.lose_fat.2", "hw.mot.head.lose_fat.3"],
  build_muscle: ["hw.mot.head.build_muscle.1", "hw.mot.head.build_muscle.2", "hw.mot.head.build_muscle.3"],
  strength: ["hw.mot.head.strength.1", "hw.mot.head.strength.2", "hw.mot.head.strength.3"],
  endurance: ["hw.mot.head.endurance.1", "hw.mot.head.endurance.2", "hw.mot.head.endurance.3"],
  default: ["hw.mot.head.default.1", "hw.mot.head.default.2", "hw.mot.head.default.3"],
};

const BODY_KEYS: Record<LoadBucket, string[]> = {
  high: ["hw.mot.body.high.1", "hw.mot.body.high.2"],
  normal: ["hw.mot.body.normal.1", "hw.mot.body.normal.2"],
  low: ["hw.mot.body.low.1", "hw.mot.body.low.2"],
};

const FOCUS_KEYS: Record<LoadBucket, string> = {
  high: "hw.mot.focus.high",
  normal: "hw.mot.focus.normal",
  low: "hw.mot.focus.low",
};

function dayIndex(date = new Date()) {
  return Math.floor(date.getTime() / 86_400_000);
}

/** Deterministic per-day message tuned to the user's goal and today's load modifier. */
export function dailyMotivation(
  goal: string | null | undefined,
  loadModifier: number | null | undefined,
  lang: Lang,
  date = new Date(),
): DailyMotivation {
  const load = Number(loadModifier ?? 1);
  const bucket: LoadBucket = load >= 1.03 ? "high" : load <= 0.92 ? "low" : "normal";
  const i = dayIndex(date);
  const headKeys = HEAD_KEYS[goal ?? "default"] ?? HEAD_KEYS["default"]!;
  const bodyKeys = BODY_KEYS[bucket];

  const headList = headKeys.map((k) => tr(lang, k as TKey));
  const bodyList = bodyKeys.map((k) => tr(lang, k as TKey));

  return {
    headline: headList[i % headList.length]!,
    body: bodyList[i % bodyList.length]!,
    focus: tr(lang, FOCUS_KEYS[bucket] as TKey),
    bucket,
    loadPct: Math.round(load * 100),
  };
}
