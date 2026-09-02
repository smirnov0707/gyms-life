import { z } from "zod";
import { LANGUAGE_NAMES, type SupportedLanguage } from "./language.schema";
import type { PlanData } from "./plan-types";

/** Collects every human-readable string of a plan, in a stable order. */
export function collectStrings(plan: PlanData): string[] {
  const out: string[] = [plan.title, plan.summary, plan.progression, plan.nutrition];
  for (const d of plan.days) {
    out.push(d.title, d.focus, d.warmup, d.cooldown);
    for (const e of d.exercises) out.push(e.name, e.notes ?? "");
  }
  return out.map((s) => s ?? "");
}

/** Rebuilds a plan from translated strings produced in collectStrings order. */
export function applyStrings(plan: PlanData, values: string[]): PlanData {
  let i = 0;
  const next = (fallback: string) => {
    const v = values[i++];
    return v && v.trim() ? v : fallback;
  };
  const title = next(plan.title);
  const summary = next(plan.summary);
  const progression = next(plan.progression);
  const nutrition = next(plan.nutrition);
  const days = plan.days.map((d) => ({
    ...d,
    title: next(d.title),
    focus: next(d.focus),
    warmup: next(d.warmup),
    cooldown: next(d.cooldown),
    exercises: d.exercises.map((e) => ({
      ...e,
      name: next(e.name),
      notes: next(e.notes ?? ""),
    })),
  }));
  return { ...plan, title, summary, progression, nutrition, days };
}

const Translated = z.object({ items: z.array(z.string()) });

export async function translatePlanData(
  plan: PlanData,
  lang: SupportedLanguage,
  userId: string,
): Promise<PlanData> {
  const source = collectStrings(plan);
  const target = LANGUAGE_NAMES[lang];
  const { generateOrchestratedJson } = await import("./ai-orchestrator.server");

  // Translate in chunks so long plans stay well within model output limits.
  const CHUNK = 60;
  const translated: string[] = [];
  for (let start = 0; start < source.length; start += CHUNK) {
    const slice = source.slice(start, start + CHUNK);
    const prompt = `Translate each string of the JSON array into ${target}.
Rules:
- Keep the SAME number of items and the SAME order.
- Keep empty strings empty.
- Keep numbers, rep ranges (e.g. "8-10"), units and " • " separators as they are.
- Use natural fitness terminology of ${target}. Return translations only, no commentary.

INPUT: ${JSON.stringify(slice)}

RETURN EXACTLY: {"items":["translated string", ...]}`;
    const res = await generateOrchestratedJson({
      task: "plan-translation",
      userId,
      prompt,
      schema: Translated,
    });
    const items = res.items.length === slice.length ? res.items : slice;
    translated.push(...items);
  }

  return applyStrings(plan, translated);
}
