import { z } from "zod";
import { LANGUAGE_NAMES, type SupportedLanguage } from "./language.schema";
import type { GeneratedMealPlan } from "./meal-types";

/** Collects every human-readable string of a meal plan, in a stable order. */
export function collectMealStrings(plan: GeneratedMealPlan): string[] {
  const out: string[] = [plan.title ?? "", plan.summary ?? "", plan.hydration ?? ""];
  for (const tip of plan.prep_tips ?? []) out.push(tip ?? "");
  for (const d of plan.days ?? []) {
    out.push(d.title ?? "");
    for (const m of d.meals ?? []) {
      out.push(m.slot ?? "", m.name ?? "", m.tip ?? "");
      for (const ing of m.ingredients ?? []) out.push(ing ?? "");
      for (const st of m.steps ?? []) out.push(st ?? "");
    }
  }
  for (const g of plan.shopping_list ?? []) {
    out.push(g.category ?? "");
    for (const i of g.items ?? []) out.push(i.name ?? "", i.amount ?? "");
  }
  out.push(plan.adaptation_note ?? "");
  return out;
}

/** Rebuilds a meal plan from translated strings produced in collectMealStrings order. */
export function applyMealStrings(plan: GeneratedMealPlan, values: string[]): GeneratedMealPlan {
  let i = 0;
  const next = (fallback: string) => {
    const v = values[i++];
    return v && v.trim() ? v : fallback;
  };

  const title = next(plan.title ?? "");
  const summary = next(plan.summary ?? "");
  const hydration = next(plan.hydration ?? "");
  const prep_tips = (plan.prep_tips ?? []).map((tp) => next(tp ?? ""));
  const days = (plan.days ?? []).map((d) => ({
    ...d,
    title: next(d.title ?? ""),
    meals: (d.meals ?? []).map((m) => ({
      ...m,
      slot: next(m.slot ?? ""),
      name: next(m.name ?? ""),
      tip: next(m.tip ?? ""),
      ingredients: (m.ingredients ?? []).map((ing) => next(ing ?? "")),
      steps: (m.steps ?? []).map((st) => next(st ?? "")),
    })),
  }));
  const shopping_list = (plan.shopping_list ?? []).map((g) => ({
    ...g,
    category: next(g.category ?? ""),
    items: (g.items ?? []).map((it) => ({
      ...it,
      name: next(it.name ?? ""),
      amount: next(it.amount ?? ""),
    })),
  }));
  const adaptation_note = next(plan.adaptation_note ?? "");

  return {
    ...plan,
    title,
    summary,
    hydration,
    prep_tips,
    days,
    shopping_list,
    ...(plan.adaptation_note ? { adaptation_note } : {}),
  };
}

const Translated = z.object({ items: z.array(z.string()) });

export async function translateMealPlan(
  plan: GeneratedMealPlan,
  lang: SupportedLanguage,
  userId: string,
): Promise<GeneratedMealPlan> {
  const source = collectMealStrings(plan);
  const target = LANGUAGE_NAMES[lang];
  const { generateJson } = await import("./ai-json.server");
  const { createAiRouterProvider } = await import("./ai-gateway.server");
  const gateway = createAiRouterProvider("meal-i18n.server");

  const CHUNK = 80;
  const translated: string[] = [];
  for (let start = 0; start < source.length; start += CHUNK) {
    const slice = source.slice(start, start + CHUNK);
    const prompt = `Translate each string of the JSON array into ${target}.
Rules:
- Keep the SAME number of items and the SAME order.
- Keep empty strings empty.
- Keep numbers, quantities, units (g, ml, kcal) and separators exactly as they are.
- Use natural cooking and nutrition terminology of ${target}. Return translations only, no commentary.

INPUT: ${JSON.stringify(slice)}

RETURN EXACTLY: {"items":["translated string", ...]}`;
    const res = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      userId,
      prompt,
      schema: Translated,
    });
    const items = res.items.length === slice.length ? res.items : slice;
    translated.push(...items);
  }

  return applyMealStrings(plan, translated);
}
