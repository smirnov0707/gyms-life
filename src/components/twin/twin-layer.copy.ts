import type { TwinDisplayTone, TwinLayer } from "./twin-scene.model";

type LayerCopy = {
  selector: string;
  label: Record<TwinLayer, string>;
  unit: Record<TwinLayer, string>;
  band: Record<TwinDisplayTone, string>;
  volumeLegend: string;
  volumeDescription: string;
  volumeNote: string;
  ranking: string;
  source: string;
};
const COPY: Record<"lt" | "en", LayerCopy> = {
  en: {
    selector: "Twin layer",
    label: { recovery: "Recovery", logged_volume: "Logged volume" },
    unit: { recovery: "% · calculated", logged_volume: "kg × reps · logged" },
    band: {
      fresh: "Fresh",
      moderate: "Moderate",
      fatigued: "Fatigued",
      unknown: "Insufficient data",
      volume_low: "Lower third",
      volume_medium: "Middle third",
      volume_high: "Upper third",
    },
    volumeLegend: "Relative logged volume",
    volumeDescription:
      "Your logged weight × reps, by region. This is not muscle growth, effort or a recovery measurement.",
    volumeNote:
      "Blue intensity is relative to the largest logged group in this window, not an effort comparison between muscles. Missing or unsupported completed-set inputs make the affected group unknown; bodyweight effort is not estimated.",
    ranking: "Largest logged volume first",
    source: "Calculated from completed set logs",
  },
  lt: {
    selector: "Dvynio sluoksnis",
    label: { recovery: "Atsistatymas", logged_volume: "Registruotas tūris" },
    unit: { recovery: "% · apskaičiuota", logged_volume: "kg × kart. · registruota" },
    band: {
      fresh: "Atsistatę",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Trūksta duomenų",
      volume_low: "Apatinis trečdalis",
      volume_medium: "Vidurinis trečdalis",
      volume_high: "Viršutinis trečdalis",
    },
    volumeLegend: "Santykinis registruotas tūris",
    volumeDescription:
      "Registruotas svoris × pakartojimai pagal regioną. Tai ne raumenų augimas, pastangos ar išmatuotas atsistatymas.",
    volumeNote:
      "Mėlynos spalvos intensyvumas lyginamas su didžiausiu registruotu grupės tūriu šiame lange, ne su raumenų pastangomis. Trūkstant užbaigto seto duomenų arba modeliui jų nepalaikant, grupė lieka nežinoma; pratimų su kūno svoriu pastangos nevertinamos.",
    ranking: "Didžiausias registruotas tūris pirmas",
    source: "Apskaičiuota iš užbaigtų setų įrašų",
  },
};
export function twinLayerCopy(language: "lt" | "en"): LayerCopy {
  return COPY[language];
}
export function formatTwinValue(value: number | null, layer: TwinLayer, language: "lt" | "en") {
  if (value === null) return "—";
  const number = new Intl.NumberFormat(language === "lt" ? "lt-LT" : "en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
  return layer === "recovery"
    ? `${number}%`
    : `${number} ${language === "lt" ? "kg × kart." : "kg × reps"}`;
}
