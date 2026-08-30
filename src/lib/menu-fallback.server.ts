export type MenuRec = { dish: string; kcal: number; protein: number; fitReason: string; orderTip: string };

const COPY: Record<string, { reason: string; tip: string; avoid: string; cuisine: string; dishes: string[] }> = {
  lt: {
    reason: "Daug baltymų, telpa į likusį dienos biudžetą.",
    tip: "Padažo prašyk atskirai, bulvių fri keisk virtomis bulvėmis ar daržovėmis.",
    avoid: "Venk kreminių padažų, kepto tešloje maisto ir saldžių gėrimų.",
    cuisine: "Mišri virtuvė",
    dishes: [
      "Grilyje kepta vištienos krūtinėlė su daržovėmis",
      "Kepta lašiša su bulvėmis ir salotomis",
      "Jautienos steikas su grilintomis daržovėmis",
      "Salotos su tunu ir kiaušiniu",
    ],
  },
  en: {
    reason: "High protein and fits the calories you have left today.",
    tip: "Ask for sauce on the side and swap fries for boiled potatoes or vegetables.",
    avoid: "Skip creamy sauces, deep-fried items and sugary drinks.",
    cuisine: "Mixed cuisine",
    dishes: [
      "Grilled chicken breast with vegetables",
      "Baked salmon with potatoes and salad",
      "Beef steak with grilled vegetables",
      "Tuna and egg salad bowl",
    ],
  },
};

/** Safe, generic recommendations for when the AI gateway is unavailable. */
export function fallbackMenu(place: string, lang: string, kcalLeft: number) {
  const c = COPY[lang] ?? COPY["en"]!;
  const cap = kcalLeft > 200 ? kcalLeft : 700;
  const base: MenuRec[] = [
    { dish: c.dishes[0]!, kcal: Math.min(520, cap), protein: 48, fitReason: c.reason, orderTip: c.tip },
    { dish: c.dishes[1]!, kcal: Math.min(620, cap), protein: 42, fitReason: c.reason, orderTip: c.tip },
    { dish: c.dishes[2]!, kcal: Math.min(700, cap), protein: 50, fitReason: c.reason, orderTip: c.tip },
    { dish: c.dishes[3]!, kcal: Math.min(430, cap), protein: 35, fitReason: c.reason, orderTip: c.tip },
  ];
  return {
    placeName: place,
    cuisine: c.cuisine,
    known: false,
    avoid: c.avoid,
    recommendations: base,
    fallback: true,
  };
}
