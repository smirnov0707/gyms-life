import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";

const Input = z.object({
  lang: SupportedLanguageSchema.default("lt"),
  count: z.number().min(3).max(24).default(12),
});

const Schema = z.object({
  lines: z
    .array(
      z.object({
        text: z.string(),
        tag: z.string().optional().default(""),
      }),
    )
    .default([]),
});

/**
 * Generates short, punchy motivational lines tailored to what this app actually
 * does: AI training plans, meal plans, exercise video technique, set tracking,
 * body composition scanning, supplements and recovery.
 */
export const generateMotivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("motivation.functions");
    const language = LANGUAGE_NAMES[data.lang];

    try {
      const res = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        userId: context.userId,
        system: `You write motivational one-liners for GYMS.LIFE, a fitness app whose real features are:
AI-generated training plans, AI meal plans with a shopping list, an exercise library with technique videos,
set/rep/weight tracking with progress charts, an AI body-composition and measurement scanner,
a food-photo calorie scanner, supplement planning with cycling advice, readiness and recovery insights.

Rules:
- Write in ${language}. Every line must be natural, idiomatic ${language} — never a literal translation.
- ${data.count} lines, each 3-9 words, uppercase-friendly, no emojis, no quotes, no numbering.
- Each line must relate to something the app genuinely does (plan, technique, tracked set, scan, nutrition, recovery) — no vague filler.
- tag = 2-3 word short label naming the feature area, in ${language}.
- All lines must be distinct in wording and idea.`,
        schema: Schema,
        maxOutputTokens: 1200,
        prompt: `Give ${data.count} fresh motivational lines for the landing page as {"lines":[{"text":"...","tag":"..."}]}. Seed: ${Math.random()
          .toString(36)
          .slice(2)}`,
      });
      const lines = res.lines
        .map((l) => ({ text: l.text.trim(), tag: (l.tag ?? "").trim() }))
        .filter((l) => l.text.length > 2 && l.text.length < 90)
        .slice(0, data.count);
      return { lines };
    } catch {
      return { lines: [] as { text: string; tag: string }[] };
    }
  });
