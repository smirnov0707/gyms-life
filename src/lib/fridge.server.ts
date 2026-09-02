import type { FridgeRecipe } from "./fridge.schema";

/** Deterministic macro estimates per 100 g for the most common fridge staples. */
const FOOD_TABLE: { match: string[]; kcal: number; p: number; c: number; f: number }[] = [
  {
    match: ["viščiuk", "vištien", "chicken", "kurica", "kurczak", "hähn", "pollo", "poulet"],
    kcal: 165,
    p: 31,
    c: 0,
    f: 3.6,
  },
  { match: ["kalakut", "turkey", "indeik"], kcal: 150, p: 29, c: 0, f: 3 },
  { match: ["jautien", "beef", "govjadin", "wołowin", "rind"], kcal: 217, p: 26, c: 0, f: 12 },
  { match: ["kiaulien", "pork", "svinin", "wieprz", "schwein"], kcal: 242, p: 27, c: 0, f: 14 },
  { match: ["lašiš", "salmon", "losos", "lachs"], kcal: 208, p: 20, c: 0, f: 13 },
  { match: ["tunas", "tuna", "tunec", "thon"], kcal: 132, p: 28, c: 0, f: 1 },
  {
    match: ["kiaušin", "egg", "jajk", "яйц", "ei", "huevo", "oeuf"],
    kcal: 143,
    p: 13,
    c: 1,
    f: 10,
  },
  { match: ["varšk", "cottage", "tvorog", "twaróg", "quark"], kcal: 98, p: 17, c: 3, f: 2 },
  { match: ["jogurt", "yogurt", "yoghurt"], kcal: 60, p: 10, c: 4, f: 0.4 },
  { match: ["sūris", "cheese", "syr", "käse", "queso"], kcal: 350, p: 25, c: 2, f: 27 },
  { match: ["aviž", "oat", "owsian", "hafer", "avena"], kcal: 380, p: 13, c: 60, f: 7 },
  { match: ["ryž", "rice", "reis", "arroz", "riz"], kcal: 350, p: 7, c: 78, f: 1 },
  { match: ["bulv", "potato", "kartofel", "ziemniak", "kartoffel"], kcal: 77, p: 2, c: 17, f: 0.1 },
  { match: ["makaron", "pasta", "nudel", "spaghetti"], kcal: 360, p: 12, c: 72, f: 1.5 },
  { match: ["grik", "buckwheat", "grecz", "гречк"], kcal: 343, p: 13, c: 62, f: 3 },
  {
    match: ["pupel", "bean", "fasol", "lentil", "lęś", "lęšiai", "čočk"],
    kcal: 330,
    p: 22,
    c: 55,
    f: 1.5,
  },
  { match: ["brokol", "broccoli", "brokuł"], kcal: 34, p: 3, c: 7, f: 0.4 },
  { match: ["špinat", "spinach", "шпинат"], kcal: 23, p: 3, c: 4, f: 0.4 },
  { match: ["pomidor", "tomato", "tomat"], kcal: 18, p: 1, c: 4, f: 0.2 },
  { match: ["agurk", "cucumber", "ogórek", "огурц"], kcal: 15, p: 1, c: 3, f: 0.1 },
  { match: ["mork", "carrot", "marchew", "морков"], kcal: 41, p: 1, c: 10, f: 0.2 },
  { match: ["svogūn", "onion", "cebul", "лук"], kcal: 40, p: 1, c: 9, f: 0.1 },
  { match: ["paprik", "pepper", "papryk", "перец"], kcal: 31, p: 1, c: 6, f: 0.3 },
  { match: ["bananas", "banana", "banan"], kcal: 89, p: 1, c: 23, f: 0.3 },
  { match: ["obuol", "apple", "jabłk", "яблок", "apfel"], kcal: 52, p: 0, c: 14, f: 0.2 },
  { match: ["avokad", "avocado"], kcal: 160, p: 2, c: 9, f: 15 },
  { match: ["aliejus", "oil", "olej", "масло", "öl"], kcal: 884, p: 0, c: 0, f: 100 },
  { match: ["sviest", "butter", "masło"], kcal: 717, p: 1, c: 0, f: 81 },
  {
    match: ["riešut", "nut", "orzech", "орех", "almond", "migdol"],
    kcal: 600,
    p: 20,
    c: 20,
    f: 50,
  },
  { match: ["duon", "bread", "chleb", "хлеб", "brot"], kcal: 265, p: 9, c: 49, f: 3 },
  { match: ["pien", "milk", "mleko", "молок", "milch"], kcal: 50, p: 3.4, c: 5, f: 1.7 },
  { match: ["tofu"], kcal: 145, p: 16, c: 3, f: 8 },
  { match: ["krevet", "shrimp", "prawn"], kcal: 99, p: 24, c: 0, f: 0.3 },
];

function lookup(name: string) {
  const n = name.toLowerCase();
  return FOOD_TABLE.find((f) => f.match.some((m) => n.includes(m)));
}

const T: Record<
  string,
  { title: string; steps: (list: string) => string[]; note: string; missing: string; time: string }
> = {
  lt: {
    title: "Greitas patiekalas iš to, ką turi",
    steps: (list) => [
      `Paruošk produktus: ${list}. Baltymų šaltinį supjaustyk vienodais gabalėliais.`,
      "Įkaitink keptuvę ant vidutinės kaitros, pirmiausia apkepk baltymų šaltinį 5–7 min.",
      "Suberk daržoves, pagardink druska, pipirais, česnaku ir troškink dar 4–5 min.",
      "Patiek su angliavandenių šaltiniu; baltymus pasverk, kad atitiktų dienos normą.",
    ],
    note: "Skaičiavimai apytiksliai — pasverk porcijas tikslesniam rezultatui.",
    missing:
      "Pridėk žalumynų ir riebalų šaltinio (alyvuogių aliejaus arba riešutų) subalansavimui.",
    time: "20 min",
  },
  en: {
    title: "Quick dish from what you have",
    steps: (list) => [
      `Prep the ingredients: ${list}. Cut the protein source into even pieces.`,
      "Heat a pan on medium and sear the protein source for 5–7 min.",
      "Add the vegetables, season with salt, pepper and garlic, cook 4–5 min more.",
      "Serve with the carb source; weigh the protein to match your daily target.",
    ],
    note: "Estimates are approximate — weigh portions for better accuracy.",
    missing: "Add greens and a fat source (olive oil or nuts) to balance the plate.",
    time: "20 min",
  },
};

/** Deterministic recipe used when the AI gateway is unavailable. */
export function fallbackRecipe(ingredients: string[], lang: string): FridgeRecipe {
  const copy = T[lang] ?? T["en"]!;
  const per = Math.max(1, ingredients.length);
  const grams = Math.round(500 / per);

  let kcal = 0,
    p = 0,
    c = 0,
    f = 0;
  for (const ing of ingredients) {
    const hit = lookup(ing) ?? { kcal: 120, p: 6, c: 12, f: 4 };
    const k = grams / 100;
    kcal += hit.kcal * k;
    p += hit.p * k;
    c += hit.c * k;
    f += hit.f * k;
  }

  return {
    title: copy.title,
    calories: Math.round(kcal),
    protein: Math.round(p),
    carbs: Math.round(c),
    fat: Math.round(f),
    time: copy.time,
    steps: copy.steps(ingredients.join(", ")),
    usedIngredients: ingredients,
    missingSuggestion: copy.missing,
    coachNote: copy.note,
    fallback: true,
  };
}
