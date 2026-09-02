/** Deterministic warm-up used when the model output cannot be parsed. */

type Drill = { slug: string; name: string; dose: string; focus: string; why: string };

const NAMES: Record<string, Record<string, string>> = {
  "cat-cow": {
    lt: "Katė–karvė",
    en: "Cat–cow",
    ru: "Кошка–корова",
    uk: "Кішка–корова",
    pl: "Kot–krowa",
    de: "Katze–Kuh",
    es: "Gato–vaca",
    fr: "Chat–vache",
  },
  "thoracic-rotation": {
    lt: "Krūtinės rotacija",
    en: "Thoracic rotation",
    ru: "Ротация грудного отдела",
    uk: "Ротація грудного відділу",
    pl: "Rotacja piersiowa",
    de: "Brustwirbel-Rotation",
    es: "Rotación torácica",
    fr: "Rotation thoracique",
  },
  "band-pull-apart": {
    lt: "Gumos atitraukimas",
    en: "Band pull-apart",
    ru: "Разведение резины",
    uk: "Розведення гумки",
    pl: "Rozciąganie gumy",
    de: "Band Pull-apart",
    es: "Apertura con banda",
    fr: "Écarté à l'élastique",
  },
  "bird-dog": {
    lt: "Paukštis–šuo",
    en: "Bird dog",
    ru: "Птица-собака",
    uk: "Птах-собака",
    pl: "Bird dog",
    de: "Bird Dog",
    es: "Bird dog",
    fr: "Bird dog",
  },
  "glute-bridge": {
    lt: "Sėdmenų tiltelis",
    en: "Glute bridge",
    ru: "Ягодичный мостик",
    uk: "Сідничний місток",
    pl: "Mostek biodrowy",
    de: "Glute Bridge",
    es: "Puente de glúteo",
    fr: "Pont fessier",
  },
  "bodyweight-squat": {
    lt: "Pritūpimai be svorio",
    en: "Bodyweight squat",
    ru: "Приседания без веса",
    uk: "Присідання без ваги",
    pl: "Przysiad bez obciążenia",
    de: "Kniebeuge ohne Gewicht",
    es: "Sentadilla sin peso",
    fr: "Squat au poids du corps",
  },
  "reverse-lunge": {
    lt: "Atbuli išpuoliai",
    en: "Reverse lunge",
    ru: "Обратные выпады",
    uk: "Зворотні випади",
    pl: "Wykrok w tył",
    de: "Ausfallschritt rückwärts",
    es: "Zancada atrás",
    fr: "Fente arrière",
  },
  "band-lateral-walk": {
    lt: "Šoniniai žingsniai su guma",
    en: "Band lateral walk",
    ru: "Боковые шаги с резиной",
    uk: "Бічні кроки з гумкою",
    pl: "Kroki bokiem z gumą",
    de: "Seitwärtsgehen mit Band",
    es: "Pasos laterales con banda",
    fr: "Pas latéraux élastique",
  },
  "jumping-jack": {
    lt: "Šuoliai su rankų mojais",
    en: "Jumping jacks",
    ru: "Прыжки «звёздочка»",
    uk: "Стрибки «зірочка»",
    pl: "Pajacyki",
    de: "Hampelmänner",
    es: "Saltos de tijera",
    fr: "Jumping jacks",
  },
  plank: {
    lt: "Lenta",
    en: "Plank",
    ru: "Планка",
    uk: "Планка",
    pl: "Deska",
    de: "Plank",
    es: "Plancha",
    fr: "Planche",
  },
};

const WHY: Record<string, string> = {
  lt: "Paruošia sąnarius ir kraujotaką prieš šios dienos pratimus.",
  en: "Primes the joints and blood flow for today's lifts.",
  ru: "Готовит суставы и кровоток к сегодняшней тренировке.",
  uk: "Готує суглоби та кровообіг до сьогоднішнього тренування.",
  pl: "Przygotowuje stawy i krążenie do dzisiejszego treningu.",
  de: "Bereitet Gelenke und Durchblutung auf das heutige Training vor.",
  es: "Prepara las articulaciones y la circulación para la sesión de hoy.",
  fr: "Prépare les articulations et la circulation pour la séance du jour.",
};

const HEADLINE: Record<string, string> = {
  lt: "Bazinis apšilimas",
  en: "Baseline warm-up",
  ru: "Базовая разминка",
  uk: "Базова розминка",
  pl: "Bazowa rozgrzewka",
  de: "Basis-Aufwärmen",
  es: "Calentamiento base",
  fr: "Échauffement de base",
};

const FOCUS: Record<string, Record<string, string>> = {
  spine: { lt: "Stuburas", en: "Spine" },
  shoulders: { lt: "Pečiai", en: "Shoulders" },
  hips: { lt: "Klubai", en: "Hips" },
  legs: { lt: "Kojos", en: "Legs" },
  core: { lt: "Liemuo", en: "Core" },
  general: { lt: "Bendras", en: "General" },
};

const UPPER = ["cat-cow", "thoracic-rotation", "band-pull-apart", "bird-dog", "plank"];
const LOWER = ["cat-cow", "glute-bridge", "band-lateral-walk", "bodyweight-squat", "reverse-lunge"];
const FULL = ["jumping-jack", "cat-cow", "glute-bridge", "bodyweight-squat", "band-pull-apart"];

const AREA: Record<string, string> = {
  "cat-cow": "spine",
  "thoracic-rotation": "spine",
  "band-pull-apart": "shoulders",
  "bird-dog": "core",
  plank: "core",
  "glute-bridge": "hips",
  "band-lateral-walk": "hips",
  "bodyweight-squat": "legs",
  "reverse-lunge": "legs",
  "jumping-jack": "general",
};

const DOSE: Record<string, string> = {
  "cat-cow": "2 x 8",
  "thoracic-rotation": "2 x 8",
  "band-pull-apart": "2 x 15",
  "bird-dog": "2 x 8",
  plank: "2 x 30 s",
  "glute-bridge": "2 x 12",
  "band-lateral-walk": "2 x 10",
  "bodyweight-squat": "2 x 12",
  "reverse-lunge": "2 x 8",
  "jumping-jack": "2 x 30 s",
};

export function fallbackWarmup(focus: string, exercises: string[], lang: string) {
  const text = `${focus} ${exercises.join(" ")}`.toLowerCase();
  const lower = /squat|leg|kojos|deadlift|glute|lunge|hip|blauzd|šlaun/.test(text);
  const upper = /bench|press|row|pull|chest|krūtin|nugar|pet|biceps|triceps/.test(text);
  const slugs = lower && upper ? FULL : lower ? LOWER : upper ? UPPER : FULL;
  const l = lang in WHY ? lang : "en";

  const drills: Drill[] = slugs.map((slug) => ({
    slug,
    name: NAMES[slug]?.[l] ?? NAMES[slug]?.["en"] ?? slug,
    dose: DOSE[slug] ?? "2 x 10",
    focus: FOCUS[AREA[slug] ?? "general"]?.[l === "lt" ? "lt" : "en"] ?? "General",
    why: WHY[l]!,
  }));

  return { headline: HEADLINE[l]!, minutes: 8, drills };
}
