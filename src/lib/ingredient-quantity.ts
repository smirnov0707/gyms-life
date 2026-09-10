/** Text quantities are evidence, not permission to guess the amount or its unit. */
export type IngredientQuantity = { qty: number | null; unit: string; name: string };
const aliases: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  gramai: "g",
  gramų: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  ltr: "l",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  vnt: "pcs",
  "vnt.": "pcs",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  šaukštas: "tbsp",
  šaukštai: "tbsp",
  šaukšto: "tbsp",
  šaukštų: "tbsp",
  "v. š.": "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  šaukštelis: "tsp",
  šaukšteliai: "tsp",
  šaukštelio: "tsp",
  šaukštelių: "tsp",
  "a. š.": "tsp",
  cup: "cup",
  cups: "cup",
  sk: "clove",
  "sk.": "clove",
  skiltelė: "clove",
  skiltelės: "clove",
  skiltelių: "clove",
  clove: "clove",
  cloves: "clove",
};
const fractions: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};
const quantity = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞])`;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const units = Object.keys(aliases)
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join("|");
const leading = new RegExp(`^(${quantity})\\s*(${units})(?:\\s+|\\s*[–—:]\\s*)(.+)$`, "iu");
const trailing = new RegExp(`^(.+?)\\s*[–—:]?\\s*(${quantity})\\s*(${units})$`, "iu");
const counted = new RegExp(`^(${quantity})\\s+([^\\d%/–—-].+)$`, "u");
function numeric(value: string): number | null {
  if (fractions[value] !== undefined) return fractions[value]!;
  const parts = value.trim().split(/\s+/);
  let result = 0;
  for (const token of parts) {
    if (token.includes("/")) {
      const [a, b] = token.split("/").map(Number);
      if (a === undefined || b === undefined || b <= 0) return null;
      result += a / b;
    } else result += Number(token.replace(",", "."));
  }
  return Number.isFinite(result) && result > 0 ? result : null;
}
export function parseIngredientQuantity(raw: string): IngredientQuantity {
  const line = raw
    .replace(/^\s*(?:[-*]\s+|•\s*)/, "")
    .replace(/\s+/g, " ")
    .trim();
  // Ranges, alternatives and unsupported amounts stay whole. They must not be
  // converted into an invented single quantity or an accidental count.
  const unknown = { qty: null, unit: "", name: line };
  if (/\d\s*[-–—]\s*\d/.test(line)) return unknown;
  const first = line.match(leading),
    last = line.match(trailing);
  if (first || last) {
    const match = first ?? last!;
    const amount = numeric(first ? match[1]! : match[2]!);
    const unit = aliases[(first ? match[2]! : match[3]!).toLocaleLowerCase()];
    const name = (first ? match[3]! : match[1]!).replace(/[\s–—:]+$/g, "").trim();
    return amount !== null && unit && name ? { qty: amount, unit, name } : unknown;
  }
  const count = line.match(counted);
  if (count) {
    const name = count[2]!.trim();
    // No unsupported measuring unit may be silently interpreted as pieces.
    if (
      /^(?:oz|ounce|ounces|lb|lbs|pound|pounds|mg|pinch|handful|bunch|pack|packet|can|tin|scoop)\b/i.test(
        name,
      )
    )
      return unknown;
    const amount = numeric(count[1]!);
    if (amount !== null) return { qty: amount, unit: "pcs", name };
  }
  return unknown;
}
export function isToTasteIngredient(raw: string): boolean {
  return (
    /^(?:salt|pepper|black pepper|druska|pipirai|juodieji pipirai)$/iu.test(raw.trim()) ||
    /(?:\bto taste\b|pagal skonį)/iu.test(raw)
  );
}
