import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LangSchema = z.string().default("lt");

/* ------------------------------------------------------------------ */
/* AI FORM CHECK — vision analysis of exercise technique from frames   */
/* ------------------------------------------------------------------ */

const FormInput = z.object({
  exerciseSlug: z.string().min(1),
  exerciseName: z.string().min(1),
  frames: z.array(z.string().startsWith("data:image/")).min(1).max(6),
  lang: LangSchema,
});

export const analyzeForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => FormInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("smart.functions");

    const schema = z.object({
      score: z.number(),
      verdict: z.string(),
      good: z.array(z.string()),
      fixes: z.array(z.string()),
      drills: z.array(z.string()),
      risk: z.string(),
    });

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const language = LANG_NAMES[data.lang] ?? "English";
    const system = `You are an elite movement-screening coach analysing still frames captured from a lifter's set.
Exercise: ${data.exerciseName} (${data.exerciseSlug}).
Judge only what is visible. If the frames are unusable (no person, too dark, wrong angle), say so in "verdict", set score 0 and leave arrays with one explanatory item.
Answer entirely in ${language}. Be specific about joints, angles, bar path, tempo and bracing. Max 2 sentences per item.
score = technique quality 0-100. risk = one short sentence about injury risk.`;

    let parsed: z.infer<typeof schema> | null = null;
    try {
      parsed = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        userId,
        system,
        schema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse my technique from these sequential frames of one repetition.",
              },
              ...data.frames.map((image) => ({ type: "image" as const, image })),
            ],
          },
        ],
      });
    } catch (error) {
      console.error("form analysis failed", error);
      parsed = null;
    }

    if (!parsed) {
      throw new Error(
        data.lang === "lt"
          ? "Nepavyko išanalizuoti kadrų. Pabandyk dar kartą su geresniu apšvietimu."
          : "Could not analyse the frames. Try again with better lighting.",
      );
    }

    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    await supabase.from("form_analyses").insert({
      user_id: userId,
      exercise_slug: data.exerciseSlug,
      exercise_name: data.exerciseName,
      score,
      verdict: parsed.verdict,
      good: parsed.good.join("\n"),
      fixes: parsed.fixes.join("\n"),
      drills: parsed.drills.join("\n"),
    });

    return { ...parsed, score };
  });

/* ------------------------------------------------------------------ */
/* READINESS / AUTOREGULATION — daily check-in scores today's load     */
/* ------------------------------------------------------------------ */

const CheckinInput = z.object({
  sleepHours: z.number().min(0).max(16),
  sleepQuality: z.number().min(1).max(5),
  soreness: z.number().min(1).max(5),
  stress: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  mood: z.number().min(1).max(5),
  lang: LangSchema,
});

export function readinessScore(i: z.infer<typeof CheckinInput>) {
  const sleepPts = Math.max(0, Math.min(1, (i.sleepHours - 4) / 4)) * 30;
  const qualityPts = ((i.sleepQuality - 1) / 4) * 20;
  const sorenessPts = ((5 - i.soreness) / 4) * 20;
  const stressPts = ((5 - i.stress) / 4) * 10;
  const energyPts = ((i.energy - 1) / 4) * 15;
  const moodPts = ((i.mood - 1) / 4) * 5;
  return Math.round(sleepPts + qualityPts + sorenessPts + stressPts + energyPts + moodPts);
}

export function loadModifier(score: number) {
  if (score >= 85) return 1.05;
  if (score >= 70) return 1;
  if (score >= 55) return 0.9;
  if (score >= 40) return 0.8;
  return 0.65;
}

export const submitCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CheckinInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const score = readinessScore(data);
    const modifier = loadModifier(score);

    const { data: recent } = await supabase
      .from("workout_sessions")
      .select("title, started_at, total_volume")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5);

    const { streamText } = await import("ai");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("smart.functions");

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const result = streamText({
      model: gateway("google/gemini-3.1-flash-lite"),
      system: `You are GYMS.LIFE's autoregulation engine. Answer in ${
        LANG_NAMES[data.lang] ?? "English"
      }. Give exactly 2-3 short sentences: how hard to train today, what to change (sets, load %, intensity, cardio) and one recovery action. No greetings, no lists.`,
      prompt: `Readiness score: ${score}/100 (recommended load ${Math.round(modifier * 100)}%).
Check-in: ${JSON.stringify(data)}
Recent workouts: ${JSON.stringify(recent ?? [])}`,
    });

    const advice = await result.text;

    await supabase.from("daily_checkins").upsert(
      {
        user_id: userId,
        checkin_on: new Date().toISOString().slice(0, 10),
        sleep_hours: data.sleepHours,
        sleep_quality: data.sleepQuality,
        soreness: data.soreness,
        stress: data.stress,
        energy: data.energy,
        mood: data.mood,
        readiness_score: score,
        load_modifier: modifier,
        advice,
      },
      { onConflict: "user_id,checkin_on" },
    );

    return { score, modifier, advice };
  });
