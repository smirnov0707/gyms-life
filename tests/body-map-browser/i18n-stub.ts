export type TKey = string;

const LABELS: Record<string, string> = {
  "mg.legs": "Legs",
  "mg.back": "Back",
  "mg.arms": "Arms",
  "mg.chest": "Chest",
  "mg.shoulders": "Shoulders",
  "mg.fullbody": "Full body",
  "mg.cardio": "Cardio",
  "mg.core": "Core",
  "mg.glutes": "Glutes",
  "mg.abs": "Abs",
  "mg.mobility": "Mobility",
};

export function baseLang(lang: string): "lt" | "en" {
  return lang === "lt" ? "lt" : "en";
}

export function useI18n() {
  return {
    lang: "en" as const,
    t: (key: string) => LABELS[key] ?? key,
  };
}
