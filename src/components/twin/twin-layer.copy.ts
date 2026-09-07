import type { TwinDisplayTone, TwinLayer } from "./twin-scene.model";

type LayerCopy = {
  selector: string;
  details: string;
  label: Record<TwinLayer, string>;
  unit: Record<TwinLayer, string>;
  band: Record<TwinDisplayTone, string>;
  volumeLegend: string;
  volumeDescription: string;
  volumeNote: string;
  ranking: string;
  source: string;
  sessionLegend: string;
  sessionDescription: string;
  sessionNote: string;
  sessionRanking: string;
};
const COPY: Record<"lt" | "en", LayerCopy> = {
  en: {
    selector: "Twin layer",
    details: "How is this calculated?",
    label: {
      recovery: "Recovery",
      logged_volume: "Logged volume",
      todays_session: "Today's session",
    },
    unit: {
      recovery: "% · calculated",
      logged_volume: "kg × reps · logged",
      todays_session: "exercises · from your programme",
    },
    band: {
      fresh: "Fresh",
      moderate: "Moderate",
      fatigued: "Fatigued",
      unknown: "Insufficient data",
      volume_low: "Lower third",
      volume_medium: "Middle third",
      volume_high: "Upper third",
      in_session: "Trained today",
      not_in_session: "Not today",
    },
    volumeLegend: "Relative logged volume",
    volumeDescription:
      "Your logged weight × reps, by region. This is not muscle growth, effort or a recovery measurement.",
    volumeNote:
      "Blue intensity is relative to the largest logged group in this window, not an effort comparison between muscles. Missing or unsupported completed-set inputs make the affected group unknown; bodyweight effort is not estimated.",
    ranking: "Largest logged volume first",
    source: "Calculated from completed set logs",
    sessionLegend: "Today's session",
    sessionDescription:
      "The regions today's session trains, read off your programme. This is not a measurement and says nothing about how recovered they are — switch to Recovery for that.",
    sessionNote:
      "A region is lit because the programme puts work on it today, not because it needs work. An exercise with no muscle group in the catalogue cannot be placed on the body and is listed separately instead of leaving its region unlit.",
    sessionRanking: "Most exercises first",
  },
  lt: {
    selector: "Dvynio sluoksnis",
    details: "Kaip apskaičiuota?",
    label: {
      recovery: "Atsistatymas",
      logged_volume: "Registruotas tūris",
      todays_session: "Šiandienos treniruotė",
    },
    unit: {
      recovery: "% · apskaičiuota",
      logged_volume: "kg × kart. · registruota",
      todays_session: "pratimai · iš tavo programos",
    },
    band: {
      fresh: "Atsistatę",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Trūksta duomenų",
      volume_low: "Apatinis trečdalis",
      volume_medium: "Vidurinis trečdalis",
      volume_high: "Viršutinis trečdalis",
      in_session: "Treniruojama šiandien",
      not_in_session: "Ne šiandien",
    },
    volumeLegend: "Santykinis registruotas tūris",
    volumeDescription:
      "Registruotas svoris × pakartojimai pagal regioną. Tai ne raumenų augimas, pastangos ar išmatuotas atsistatymas.",
    volumeNote:
      "Mėlynos spalvos intensyvumas lyginamas su didžiausiu registruotu grupės tūriu šiame lange, ne su raumenų pastangomis. Trūkstant užbaigto seto duomenų arba modeliui jų nepalaikant, grupė lieka nežinoma; pratimų su kūno svoriu pastangos nevertinamos.",
    ranking: "Didžiausias registruotas tūris pirmas",
    source: "Apskaičiuota iš užbaigtų setų įrašų",
    sessionLegend: "Šiandienos treniruotė",
    sessionDescription:
      "Regionai, kuriuos treniruoja šiandienos programa. Tai ne matavimas ir nieko nesako apie tai, kiek jie atsistatę — tam perjunk į Atsistatymą.",
    sessionNote:
      "Regionas šviečia todėl, kad programa jam šiandien skiria darbo, o ne todėl, kad jam darbo reikia. Pratimo be raumenų grupės kataloge ant kūno padėti neįmanoma, todėl jis išvardijamas atskirai, o ne palieka savo regioną neužšviestą.",
    sessionRanking: "Daugiausia pratimų pirma",
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
