import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PhotoInput = z.object({
  image: z.string().startsWith("data:image/"),
  lang: z.string().default("lt"),
});

const looseNum = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}, z.number().min(0));

const looseBool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|yes|taip|1|with food|su maistu)$/i.test(v.trim());
  return false;
}, z.boolean());

const CATEGORIES = [
  "protein",
  "creatine",
  "vitamin",
  "mineral",
  "iron",
  "calcium",
  "omega",
  "preworkout",
  "electrolyte",
  "probiotic",
  "general",
] as const;

const PREF_TIMES = ["any", "morning", "pre_workout", "post_workout", "evening", "bedtime"] as const;

const looseCategory = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase();
  return (CATEGORIES as readonly string[]).includes(s) ? s : "general";
}, z.enum(CATEGORIES));

const loosePref = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase().replace(/[\s-]/g, "_");
  return (PREF_TIMES as readonly string[]).includes(s) ? s : "any";
}, z.enum(PREF_TIMES));

const ScanSchema = z.object({
  isSupplement: z.boolean().default(false),
  subject: z.string().default(""),
  rejectReason: z.string().default(""),
  products: z
    .array(
      z.object({
        name: z.string().default(""),
        brand: z.string().default(""),
        readable: z.string().default(""),
        category: looseCategory.default("general"),
        dose: z.string().default(""),
        timesPerDay: looseNum.default(1),
        withFood: looseBool.default(false),
        preferredTime: loosePref.default("any"),
        notes: z.string().default(""),
        confidence: looseNum.default(0),
      }),
    )
    .default([]),
});

export const analyzeSupplementPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoInput.parse(input))
  .handler(async ({ data, context }) => {

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("supplement-vision.functions");
    const language = LANG_NAMES[data.lang] ?? "English";

    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, goal, gender, birth_year, days_per_week")
      .eq("id", userId)
      .maybeSingle();

    const athlete = [
      profile?.weight_kg ? `weight ${profile.weight_kg} kg` : "",
      profile?.gender ? `gender ${profile.gender}` : "",
      profile?.birth_year ? `born ${profile.birth_year}` : "",
      profile?.goal ? `goal ${profile.goal}` : "",
      profile?.days_per_week ? `${profile.days_per_week} training days/week` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const system = `You are a supplement-label recognition expert for athletes.

STEP 1 — GATEKEEPING. Describe in "subject" what the image really shows. Set isSupplement=true ONLY when one or more supplement products (tubs, jars, bottles, blisters, sachets) are visible. For anything else (food, people, electronics, blurry/dark photos) set isSupplement=false, products=[] and write rejectReason as one short sentence in ${language} explaining what you see and asking for a photo of the supplement label.

STEP 2 — READING. For EACH visible product read the label text literally. Use the exact printed product/brand name and the printed serving size. Never invent a product you cannot read. If several products are in the photo, return each separately (max 4).
- name: printed product name (keep brand-neutral wording, e.g. "Creatine Monohydrate"), brand: printed brand if legible.
- readable: the key label text you actually read (serving size, amount per serving).
- category: one of ${CATEGORIES.join(", ")}.
- confidence: 0-100 honest label legibility.

STEP 3 — DOSING PLAN for this athlete (${athlete || "no profile data"}).
- dose: exact amount per intake, with units, based on the label's serving size adjusted to this athlete's bodyweight and goal.
- timesPerDay: integer 1-4, how many intakes per day.
- withFood: true if absorption/tolerance requires food.
- preferredTime: one of ${PREF_TIMES.join(", ")}.
- notes: one short practical sentence in ${language} (timing/absorption/interaction).

Write name/notes/readable in ${language} where it is not a printed brand name.
Return exactly: {"isSupplement":true,"subject":"","rejectReason":"","products":[{"name":"","brand":"","readable":"","category":"general","dose":"","timesPerDay":1,"withFood":false,"preferredTime":"any","notes":"","confidence":0}]}`;

    const result = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      system,
      schema: ScanSchema,
      maxOutputTokens: 1600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Read the supplement label(s) in this photo and build the dosing plan.",
            },
            { type: "image" as const, image: data.image },
          ],
        },
      ],
    });

    const products = result.products.filter((p) => p.name.trim().length > 0).slice(0, 4);

    if (!result.isSupplement || products.length === 0) {
      return {
        ok: false as const,
        subject: result.subject,
        reason:
          result.rejectReason ||
          (data.lang === "lt"
            ? "Nuotraukoje nematau papildo etiketės. Nufotografuok pakuotę iš arti."
            : "No supplement label detected. Take a close-up photo of the package."),
      };
    }

    return {
      ok: true as const,
      products: products.map((p) => ({
        name: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase())
          ? `${p.brand} ${p.name}`.trim()
          : p.name.trim(),
        readable: p.readable,
        category: p.category,
        dose: p.dose,
        timesPerDay: Math.min(4, Math.max(1, Math.round(p.timesPerDay || 1))),
        withFood: p.withFood,
        preferredTime: p.preferredTime,
        notes: p.notes,
        confidence: Math.min(100, Math.round(p.confidence)),
      })),
    };
  });
