export type ProgressSignal = "PROGRESSING" | "STAGNATING" | "FATIGUE_RISK" | "INSUFFICIENT_DATA";

export type ExercisePoint = {
  date: string;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  estimated1RMKg: number | null;
};

export type ProgressInsight = {
  signal: ProgressSignal;
  confidence: number;
  headline: string;
  explanation: string;
  recommendation: string;
  evidence: Array<{ metric: string; value: number | string }>;
};

function round(value: number) {
  return Number(value.toFixed(1));
}

export function analyzeExerciseProgress(points: ExercisePoint[]): ProgressInsight {
  const usable = points.filter((point) => point.estimated1RMKg != null);
  if (usable.length < 3)
    return {
      signal: "INSUFFICIENT_DATA",
      confidence: 0.35,
      headline: "Dar per mažai duomenų",
      explanation:
        "Reikia bent kelių atliktų setų su svoriu ir pakartojimais, kad būtų galima patikimai vertinti kryptį.",
      recommendation: "Toliau registruok svorį, pakartojimus ir RPE kiekvienoje treniruotėje.",
      evidence: [{ metric: "usable_points", value: usable.length }],
    };

  const recent = usable.slice(-3);
  const first = recent[0]!.estimated1RMKg!;
  const last = recent[recent.length - 1]!.estimated1RMKg!;
  const changePct = first > 0 ? round(((last - first) / first) * 100) : 0;
  const recentRpe = recent
    .map((point) => point.rpe)
    .filter((value): value is number => value != null);
  const avgRpe = recentRpe.length
    ? round(recentRpe.reduce((a, b) => a + b, 0) / recentRpe.length)
    : null;
  const rpeEvidence = avgRpe == null ? [] : [{ metric: "recent_average_rpe", value: avgRpe }];

  if (changePct >= 3)
    return {
      signal: "PROGRESSING",
      confidence: Math.min(0.95, 0.65 + Math.abs(changePct) / 100),
      headline: "Progresas matomas",
      explanation: `Naujausių setų estimated 1RM kryptis pakilo apie ${changePct}%.`,
      recommendation:
        "Išlaikyk dabartinį krūvį ir, jei technika bei RPE išlieka geri, kitą kartą didink svorį mažu žingsniu.",
      evidence: [{ metric: "estimated_1rm_change_pct", value: changePct }, ...rpeEvidence],
    };
  if (changePct <= -5 || (avgRpe != null && avgRpe >= 9 && changePct < 0))
    return {
      signal: "FATIGUE_RISK",
      confidence: 0.78,
      headline: "Galimas nuovargio signalas",
      explanation:
        "Našumo kryptis blogėja, o didelis RPE gali rodyti, kad dabartinis krūvis per sunkus atsistatymui.",
      recommendation:
        "Neskubėk didinti svorio. Įvertink atsistatymą ir, jei signalas kartojasi, sumažink krūvį arba apimtį.",
      evidence: [{ metric: "estimated_1rm_change_pct", value: changePct }, ...rpeEvidence],
    };
  return {
    signal: "STAGNATING",
    confidence: 0.68,
    headline: "Progresas lėtėja",
    explanation: "Naujausių atlikimų estimated 1RM reikšmingai nepasikeitė.",
    recommendation:
      "Kitose treniruotėse siek nedidelio pakartojimų arba svorio progreso, nekeisdamas kelių kintamųjų vienu metu.",
    evidence: [{ metric: "estimated_1rm_change_pct", value: changePct }, ...rpeEvidence],
  };
}
