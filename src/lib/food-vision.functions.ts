import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PhotoInput = z.object({
  image: z.string().startsWith("data:image/"),
  lang: z.string().default("lt"),
});

const PhotoSchema = z.object({
  isFood: z.boolean(),
  subject: z.string().default(""),
  rejectReason: z.string().default(""),
  confidence: z.number().min(0).max(100).default(0),
  dishName: z.string().default(""),
  calories: z.number().min(0).max(6000).default(0),
  protein: z.number().min(0).max(500).default(0),
  carbs: z.number().min(0).max(800).default(0),
  fat: z.number().min(0).max(400).default(0),
  items: z.array(z.string()).default([]),
  note: z.string().default(""),
});

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoInput.parse(input))
  .handler(async ({ data }) => {

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("food-vision.functions");
    const language = LANG_NAMES[data.lang] ?? "English";

    const system = `You are a strict food-recognition vision analyst.

STEP 1 — GATEKEEPING (mandatory, be honest). Look at the image and name what it actually shows in "subject" (e.g. "laptop computer", "a person", "a dog", "empty table", "screenshot", "plate of pasta").
Set isFood=true ONLY when real, edible food or drink is clearly visible in the photo.
Set isFood=false for: electronics, computers, phones, furniture, people without food, animals, landscapes, text/screenshots, drawings, empty plates, or anything unclear/too dark/too blurry.
NEVER invent a meal. If isFood=false: write rejectReason as one short sentence in ${language} that names what you actually see and asks for a photo of food; set all numbers to 0 and items to [].

STEP 2 — ANALYSIS (only when isFood=true). Identify every visible component and estimate its cooked weight in grams using plate/cutlery/hand size as scale reference. Sum realistic macros for the WHOLE portion shown.
dishName = short name of the dish in ${language}.
items = each component with estimated grams, in ${language} (e.g. "Grilled chicken ~180 g").
confidence = 0-100 honest reliability given photo quality and hidden ingredients.
note = 1 short practical sentence in ${language} for an athlete.
Numbers: calories in kcal, protein/carbs/fat in grams. Do not guess ingredients that are not visible.`;

    const result = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      system,
      schema: PhotoSchema,
      maxOutputTokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "First state exactly what this image shows, then analyse it per the rules.",
            },
            { type: "image" as const, image: data.image },
          ],
        },
      ],
    });

    if (!result.isFood || result.calories <= 0) {
      return {
        ok: false as const,
        subject: result.subject,
        reason:
          result.rejectReason ||
          (data.lang === "lt"
            ? "Nuotraukoje nematau maisto. Nufotografuok patiekalą iš viršaus."
            : "No food detected in this photo. Take a picture of a meal from above."),
      };
    }

    const round = (n: number) => Math.max(0, Math.round(n));
    return {
      ok: true as const,
      dishName: result.dishName,
      calories: round(result.calories),
      protein: round(result.protein),
      carbs: round(result.carbs),
      fat: round(result.fat),
      items: result.items.slice(0, 8),
      confidence: Math.round(result.confidence),
      note: result.note,
    };
  });

const SavePhotoMeal = z.object({
  dishName: z.string().min(1).max(200),
  calories: z.number().min(0).max(6000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(800),
  fat: z.number().min(0).max(400),
  note: z.string().max(400).default(""),
});

export const savePhotoMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SavePhotoMeal.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted } = await supabase
      .from("nutrition_logs")
      .insert({
        user_id: userId,
        description: data.dishName,
        food_name: data.dishName,
        calories: Math.round(data.calories),
        protein: Math.round(data.protein),
        carbs: Math.round(data.carbs),
        fat: Math.round(data.fat),
        note: data.note,
      })
      .select("id")
      .single();
    return { ok: true as const, id: inserted?.id ?? null };
  });

const MenuInput = z.object({
  place: z.string().max(120).default(""),
  city: z.string().max(120).default(""),
  goal: z.string().max(40).default("muscle"),
  kcalLeft: z.number().min(0).max(6000).default(800),
  proteinLeft: z.number().min(0).max(400).default(50),
  lang: z.string().default("lt"),
});

/** Models sometimes answer with "true"/"yes"/a sentence instead of a boolean. */
const looseBool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return !/^(false|no|ne|0|unknown|nezinoma)$/i.test(v.trim()) && v.trim() !== "";
  return false;
}, z.boolean());

const looseNum = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}, z.number().min(0));

const MenuSchema = z.object({
  placeName: z.string().default(""),
  cuisine: z.string().default(""),
  known: looseBool.default(false),
  recommendations: z
    .array(
      z.object({
        dish: z.string(),
        kcal: looseNum.default(0),
        protein: looseNum.default(0),
        fitReason: z.string().default(""),
        orderTip: z.string().default(""),
      }),
    )
    .default([]),
  avoid: z.string().default(""),
});


export const recommendMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MenuInput.parse(input))
  .handler(async ({ data }) => {

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("food-vision.functions");
    const language = LANG_NAMES[data.lang] ?? "English";

    const system = `You are a sports nutritionist who helps athletes order well when eating out.

Answer entirely in ${language}.
Venue: "${data.place || "unspecified"}"${data.city ? ` in ${data.city}` : ""}.
If you genuinely recognise this venue, set known=true and recommend dishes typical of its real menu style. If you do NOT recognise it, set known=false and recommend realistic dishes for the most likely cuisine of a venue with that name in that city — never invent a fake signature dish and never claim certainty.
cuisine = short cuisine label. placeName = tidy name of the venue.

Athlete budget for the rest of the day: ${Math.round(data.kcalLeft)} kcal and ${Math.round(data.proteinLeft)} g protein left. Goal: ${data.goal}.
Give 3-4 recommendations that together stay inside that budget individually (each dish must fit the remaining kcal).
kcal and protein = realistic restaurant portion estimates.
fitReason = 1 short sentence why it fits the athlete's budget and goal.
orderTip = concrete ordering tweak (e.g. sauce on the side, swap fries for potatoes, add extra chicken).
avoid = 1 short sentence naming the type of dish to skip at this venue.

Return exactly this JSON shape (known is a JSON boolean, kcal/protein are plain numbers):
{"placeName":"","cuisine":"","known":true,"recommendations":[{"dish":"","kcal":0,"protein":0,"fitReason":"","orderTip":""}],"avoid":""}`;

    const { fallbackMenu } = await import("./menu-fallback.server");

    let result;
    try {
      result = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        system,
        prompt: `Recommend dishes at ${data.place || "a local restaurant"}${data.city ? `, ${data.city}` : ""}.`,
        schema: MenuSchema,
        maxOutputTokens: 2600,
      });
    } catch {
      return fallbackMenu(data.place || "", data.lang, data.kcalLeft);
    }

    if (result.recommendations.length === 0) return fallbackMenu(data.place || "", data.lang, data.kcalLeft);

    return {
      placeName: result.placeName || data.place,
      cuisine: result.cuisine,
      known: result.known,
      avoid: result.avoid,
      recommendations: result.recommendations.slice(0, 4).map((r) => ({
        ...r,
        kcal: Math.round(r.kcal),
        protein: Math.round(r.protein),
      })),
      fallback: false,
    };
  });

