import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import {
  calculateReadinessScore,
  DailyReadinessFactorsSchema,
  loadModifierFor,
} from "./readiness.engine";

const LangSchema = SupportedLanguageSchema.default("lt");

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

    const { generateOrchestratedJson } = await import("./ai-orchestrator.server");

    const schema = z.object({
      score: z.number(),
      verdict: z.string(),
      good: z.array(z.string()),
      fixes: z.array(z.string()),
      drills: z.array(z.string()),
      risk: z.string(),
    });

    const language = LANGUAGE_NAMES[data.lang];
    const system = `You are an elite movement-screening coach analysing still frames captured from a lifter's set.
Exercise: ${data.exerciseName} (${data.exerciseSlug}).
Judge only what is visible. If the frames are unusable (no person, too dark, wrong angle), say so in "verdict", set score 0 and leave arrays with one explanatory item.
Answer entirely in ${language}. Be specific about joints, angles, bar path, tempo and bracing. Max 2 sentences per item.
score = technique quality 0-100. risk = one short sentence about injury risk.`;

    let parsed: z.infer<typeof schema> | null = null;
    try {
      parsed = await generateOrchestratedJson({
        task: "form-analysis",
        supabase,
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
    const { error: saveError } = await supabase.from("form_analyses").insert({
      user_id: userId,
      exercise_slug: data.exerciseSlug,
      exercise_name: data.exerciseName,
      score,
      verdict: parsed.verdict,
      good: parsed.good.join("\n"),
      fixes: parsed.fixes.join("\n"),
      drills: parsed.drills.join("\n"),
    });
    if (saveError) throw new Error("Could not save form analysis.");

    return { ...parsed, score };
  });

/* ------------------------------------------------------------------ */
/* READINESS / AUTOREGULATION — daily check-in scores today's load     */
/* ------------------------------------------------------------------ */

const CheckinInput = DailyReadinessFactorsSchema.extend({ lang: LangSchema }).strict();
const ReadinessAdjustmentInputSchema = z
  .object({ score: z.number().finite().min(0).max(100) })
  .strict();

export function readinessScore(i: z.infer<typeof CheckinInput>) {
  return calculateReadinessScore({
    sleepHours: i.sleepHours,
    sleepQuality: i.sleepQuality,
    soreness: i.soreness,
    stress: i.stress,
    energy: i.energy,
    mood: i.mood,
  });
}

export const loadModifier = loadModifierFor;

function deterministicReadinessAdvice(
  score: number,
  modifier: number,
  lang: z.infer<typeof LangSchema>,
): string {
  if (lang === "lt") {
    if (score < 40) {
      return "Šiandien rinkis atsistatymą. Netreniruok su papildomu svoriu ir įvertink savijautą rytoj.";
    }
    if (score < 55) {
      return "Šiandien mažink apimtį ir nekelk svorio. Palik 2–3 pakartojimų atsargą bei prioritetą skirk atsistatymui.";
    }
    if (score < 70) {
      return `Treniruokis konservatyviai, su ${Math.round(modifier * 100)}% planuoto krūvio. Rinkis techniškai stabilų tempą ir trumpesnę sesiją, jei reikia.`;
    }
    return "Dabartinis pasiruošimas palaiko suplanuotą treniruotę. Laikykis technikos ir sustok, jei atsiranda neįprastas skausmas.";
  }

  if (score < 40) {
    return "Choose recovery today. Do not add training load and reassess how you feel tomorrow.";
  }
  if (score < 55) {
    return "Reduce volume today and do not increase load. Leave 2–3 reps in reserve and prioritise recovery.";
  }
  if (score < 70) {
    return `Train conservatively at ${Math.round(modifier * 100)}% of planned load. Keep technique steady and shorten the session if needed.`;
  }
  return "Your current readiness supports the planned session. Keep technique strict and stop if unusual pain appears.";
}

export const submitCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CheckinInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const score = readinessScore(data);
    const modifier = loadModifier(score);
    const advice = deterministicReadinessAdvice(score, modifier, data.lang);

    const { error: saveError } = await supabase.from("daily_checkins").upsert(
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
    if (saveError) throw new Error("Could not save daily check-in.");

    const { completeCurrentReadinessDecision } = await import("./today-decision.server");
    await completeCurrentReadinessDecision(userId, new Date());

    return { score, modifier, advice };
  });

/** Saves the compact Today-screen adjustment through the same server-owned decision loop. */
export const saveReadinessAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ReadinessAdjustmentInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const score = Math.round(data.score);
    const modifier = loadModifierFor(score);
    const checkinOn = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase.from("daily_checkins").upsert(
      {
        user_id: context.userId,
        checkin_on: checkinOn,
        readiness_score: score,
        load_modifier: modifier,
      },
      { onConflict: "user_id,checkin_on" },
    );
    if (error) throw new Error("Could not save readiness adjustment.");

    const { completeCurrentReadinessDecision } = await import("./today-decision.server");
    await completeCurrentReadinessDecision(context.userId, new Date());
    return { score, modifier };
  });
