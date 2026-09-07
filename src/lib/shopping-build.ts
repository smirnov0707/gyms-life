import type { GeneratedMealPlan, ShoppingGroup } from "./meal-types";

/**
 * Builds the weekly shopping list directly from every ingredient used in the
 * 7-day plan, so the list always matches the meals (AI-generated lists often
 * skipped items). Quantities with the same unit are summed together.
 */

type Parsed = { qty: number | null; unit: string; name: string };

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  gramai: "g",
  gramų: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  ltr: "l",
  vnt: "vnt.",
  "vnt.": "vnt.",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  šaukštai: "šaukštai",
  šaukštas: "šaukštai",
  šaukšto: "šaukštai",
  šaukšteliai: "šaukšteliai",
  šaukštelis: "šaukšteliai",
  tbsp: "tbsp",
  tsp: "tsp",
  cup: "cup",
  cups: "cup",
  sk: "sk.",
  skiltelės: "sk.",
};

const NUM = "(\\d+(?:[.,]\\d+)?)";
const UNIT = "([a-zA-Zžčęėįšųūā.]+\\.?)";

function parseIngredient(raw: string): Parsed {
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line) return { qty: null, unit: "", name: "" };

  // "150 g vištienos" | "vištienos 150 g" | "2 vnt. kiaušinių"
  const lead = line.match(new RegExp(`^${NUM}\\s*${UNIT}?\\s*(.*)$`));
  const trail = line.match(new RegExp(`^(.*?)[\\s,–-]*${NUM}\\s*${UNIT}?$`));

  const norm = (u?: string) => {
    if (!u) return "";
    const key = u.toLowerCase().replace(/[.,]$/, "");
    return UNIT_ALIASES[key] ?? UNIT_ALIASES[`${key}.`] ?? "";
  };

  if (lead) {
    const unit = norm(lead[2]);
    const rest = unit ? lead[3] : [lead[2], lead[3]].filter(Boolean).join(" ");
    if (rest?.trim()) {
      return { qty: Number(lead[1]!.replace(",", ".")), unit, name: rest.trim() };
    }
  }
  if (trail && trail[1]?.trim()) {
    return {
      qty: Number(trail[2]!.replace(",", ".")),
      unit: norm(trail[3]),
      name: trail[1].trim(),
    };
  }
  return { qty: null, unit: "", name: line };
}

const cleanName = (n: string) =>
  n
    .replace(/^[-•*]\s*/, "")
    .replace(/[(),.]+$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

const CATEGORIES: { key: string; words: string[] }[] = [
  {
    key: "protein",
    words: [
      "vištien",
      "kalakut",
      "jautien",
      "kiaulien",
      "menk",
      "lašiš",
      "tunas",
      "tuno",
      "žuv",
      "kiaušin",
      "varšk",
      "jogurt",
      "sūr",
      "išrūgų",
      "baltym",
      "tofu",
      "tempeh",
      "krevet",
      "chicken",
      "turkey",
      "beef",
      "pork",
      "salmon",
      "tuna",
      "fish",
      "egg",
      "cottage",
      "yogurt",
      "yoghurt",
      "cheese",
      "whey",
      "protein",
      "shrimp",
      "curd",
    ],
  },
  {
    key: "produce",
    words: [
      "daržov",
      "špinat",
      "brokol",
      "pomidor",
      "agurk",
      "salot",
      "morkų",
      "morkos",
      "svogūn",
      "česnak",
      "paprik",
      "cukin",
      "kopūst",
      "bulv",
      "batat",
      "avokad",
      "bананų",
      "banan",
      "obuol",
      "uog",
      "citrin",
      "apelsin",
      "vaisi",
      "grybų",
      "grybai",
      "vegetable",
      "spinach",
      "broccoli",
      "tomato",
      "cucumber",
      "salad",
      "lettuce",
      "carrot",
      "onion",
      "garlic",
      "pepper",
      "zucchini",
      "cabbage",
      "potato",
      "avocado",
      "banana",
      "apple",
      "berry",
      "berries",
      "lemon",
      "orange",
      "fruit",
      "mushroom",
    ],
  },
  {
    key: "grains",
    words: [
      "ryž",
      "grik",
      "aviž",
      "makaron",
      "duon",
      "bulgur",
      "kuskus",
      "kvinoj",
      "quinoa",
      "miltai",
      "tortil",
      "lęš",
      "pupel",
      "avinž",
      "kruop",
      "rice",
      "buckwheat",
      "oat",
      "pasta",
      "bread",
      "couscous",
      "flour",
      "tortilla",
      "lentil",
      "bean",
      "chickpea",
      "grain",
    ],
  },
  {
    key: "fats",
    words: [
      "aliej",
      "sviest",
      "riešut",
      "migdol",
      "sėkl",
      "chia",
      "tahini",
      "alyvuog",
      "kokos",
      "oil",
      "butter",
      "nut",
      "almond",
      "seed",
      "olive",
      "coconut",
      "peanut",
    ],
  },
  {
    key: "pantry",
    words: [
      "druska",
      "pipir",
      "prieskoni",
      "medus",
      "actas",
      "padaž",
      "kakav",
      "cinamon",
      "kefyr",
      "pienas",
      "gėrimas",
      "vanduo",
      "sultys",
      "salt",
      "pepper",
      "spice",
      "honey",
      "vinegar",
      "sauce",
      "cocoa",
      "cinnamon",
      "milk",
      "water",
      "juice",
      "drink",
    ],
  },
];

const CATEGORY_LABELS: Record<string, { lt: string; en: string }> = {
  protein: { lt: "Baltymai ir mėsa", en: "Protein & meat" },
  produce: { lt: "Daržovės ir vaisiai", en: "Produce" },
  grains: { lt: "Kruopos, duona, ankštiniai", en: "Grains & legumes" },
  fats: { lt: "Riebalai, riešutai, sėklos", en: "Fats, nuts & seeds" },
  pantry: { lt: "Sandėliukas ir gėrimai", en: "Pantry & drinks" },
  other: { lt: "Kita", en: "Other" },
};

function categoryOf(name: string) {
  const n = name.toLowerCase();
  for (const c of CATEGORIES) if (c.words.some((w) => n.includes(w))) return c.key;
  return "other";
}

const round = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");

/** Aggregates every ingredient of the plan into a categorized shopping list. */
/**
 * Units that measure the same thing, and what one of them is worth in the
 * smallest of them.
 *
 * Summing kept these apart, so half a kilo of chicken on Monday and a kilo on
 * Tuesday came out as "500 g + 1 kg" — the right total, written as two things
 * to buy. The display already converted grams to kilos above a thousand, so it
 * knew they were the same dimension; only the addition did not.
 */
const UNIT_DIMENSION: Record<string, { dimension: string; inBase: number }> = {
  g: { dimension: "mass", inBase: 1 },
  kg: { dimension: "mass", inBase: 1000 },
  ml: { dimension: "volume", inBase: 1 },
  l: { dimension: "volume", inBase: 1000 },
};

/** The key a quantity is accumulated under: its dimension, or the unit itself. */
const accumulationKey = (unit: string) => UNIT_DIMENSION[unit]?.dimension ?? unit;

/** Formats a summed amount back into the largest unit that suits it. */
function formatAmount(key: string, value: number): string {
  if (key === "mass") return value >= 1000 ? `${round(value / 1000)} kg` : `${round(value)} g`;
  if (key === "volume") return value >= 1000 ? `${round(value / 1000)} l` : `${round(value)} ml`;
  return `${round(value)} ${key}`;
}

export function buildShoppingList(plan: GeneratedMealPlan, lang: string): ShoppingGroup[] {
  const bucket = new Map<
    string,
    { name: string; category: string; units: Map<string, number>; freeform: number }
  >();

  for (const day of plan.days ?? []) {
    for (const meal of day.meals ?? []) {
      for (const raw of meal.ingredients ?? []) {
        const parsed = parseIngredient(String(raw));
        const name = cleanName(parsed.name || String(raw));
        if (!name || name.length < 2) continue;
        const key = name.toLowerCase();
        const entry = bucket.get(key) ?? {
          name,
          category: categoryOf(name),
          units: new Map<string, number>(),
          freeform: 0,
        };
        if (parsed.qty != null && Number.isFinite(parsed.qty)) {
          const unit = parsed.unit || "vnt.";
          // Accumulated per dimension, so grams and kilos of the same
          // ingredient add up instead of being listed side by side.
          const key = accumulationKey(unit);
          const inBase = UNIT_DIMENSION[unit]?.inBase ?? 1;
          entry.units.set(key, (entry.units.get(key) ?? 0) + parsed.qty * inBase);
        } else {
          entry.freeform += 1;
        }
        bucket.set(key, entry);
      }
    }
  }

  if (bucket.size === 0) return plan.shopping_list ?? [];

  const groups = new Map<string, ShoppingGroup>();
  const order = ["protein", "produce", "grains", "fats", "pantry", "other"];

  for (const entry of bucket.values()) {
    const parts: string[] = [];
    for (const [key, value] of entry.units) parts.push(formatAmount(key, value));
    // Mentions that carried no amount at all. With a quantity beside them this
    // used to append a bare count, so salt came out as "150 g + +1" — a
    // doubled plus and a number nobody can buy. What those mentions actually
    // say is "and some, to taste", so that is what they say.
    if (entry.freeform) parts.push(lang === "lt" ? "pagal skonį" : "to taste");

    const label = (CATEGORY_LABELS[entry.category] ?? CATEGORY_LABELS["other"]!)[
      lang === "lt" ? "lt" : "en"
    ];
    const group = groups.get(entry.category) ?? { category: label, items: [] };
    group.items.push({
      name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
      amount: parts.join(" + "),
    });
    groups.set(entry.category, group);
  }

  return order
    .filter((k) => groups.has(k))
    .map((k) => {
      const g = groups.get(k)!;
      return { ...g, items: g.items.sort((a, b) => a.name.localeCompare(b.name)) };
    });
}

/** Returns the plan with a shopping list that always matches its meals. */
export function withCompleteShoppingList(plan: GeneratedMealPlan, lang: string): GeneratedMealPlan {
  return { ...plan, shopping_list: buildShoppingList(plan, lang) };
}
