import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateJson } from "./ai-json.server";
import { askFastTextAi } from "./ai-gateway.server";
import { buildUserContext, contextForAi } from "./user-context.server";

const IntakeSchema = z.object({
  goal: z.string(),
  experience: z.string(),
  location: z.string(),
  equipment: z.array(z.string()),
  daysPerWeek: z.number().min(1).max(7),
  sessionMinutes: z.number().min(15).max(120),
  age: z.number().nullable().optional(),
  gender: z.string().nullable().optional(),
  heightCm: z.number().nullable().optional(),
  weightKg: z.number().nullable().optional(),
  targetWeightKg: z.number().nullable().optional(),
  limitations: z.string().nullable().optional(),
  lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]).default("lt"),
});

export type Intake = z.infer<typeof IntakeSchema>;

const text = (fallback = "") =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.join(" • ") : typeof v === "number" ? String(v) : v),
    z.string().default(fallback),
  );
const num = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? fallback : v),
    z.coerce.number().default(fallback),
  );

const PlanExercise = z.object({
  slug: text("exercise"),
  name: text("Pratimas"),
  sets: num(3),
  reps: text("8-12"),
  rest_seconds: num(90),
  notes: text(""),
});

const PlanDay = z.object({
  day: num(1),
  title: text("Treniruotė"),
  focus: text("Pagrindinės raumenų grupės"),
  warmup: text("Dinaminis apšilimas 5-7 min"),
  cooldown: text("Lengvas tempimas ir kvėpavimas"),
  estimated_minutes: num(45),
  exercises: z.array(PlanExercise).default([]),
});

const PlanSchema = z.object({
  title: text("GYMS.LIFE INDIVIDUALUS PLANAS"),
  summary: text("Moksliškai subalansuota programa jūsų tikslams pasiekti."),
  weeks: num(8),
  progression: text("Kas savaitę didinkite darbinį svorį arba pakartojimų skaičių išlaikant RPE 7-9."),
  nutrition: text("Išlaikykite 1.8-2.2g/kg baltymų normą ir gerkite bent 2.5-3L vandens per dieną."),
  days: z.array(PlanDay),
});

export type GeneratedPlan = z.infer<typeof PlanSchema>;

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IntakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: exercises } = await supabase
      .from("exercises")
      .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty");

    const catalog = (exercises ?? []).length > 0
      ? (exercises ?? []).map((e) => `${e.slug} | ${e.name_en} / ${e.name_lt} | ${e.muscle_group} | ${e.equipment}`).join("\n")
      : `bench-press | Barbell Bench Press / Spaudimas štanga | chest | barbell
squat | Barbell Squat / Pritūpimai su štanga | legs | barbell
deadlift | Barbell Deadlift / Mirties trauka | back | barbell
pull-up | Pull Up / Prisitraukimai | back | bodyweight
push-up | Push Up / Atsispaudimai | chest | bodyweight
lunge | Dumbbell Lunge / Įtūpstai su hanteliais | legs | dumbbell
plank | Plank / Lenta | core | bodyweight`;

    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const prompt = `Tu esi GYMS.LIFE elitinis jėgos ir biomechanikos treneris.
Sukurk profesionalią, moksliškai pagrįstą treniruočių programą šiam vartotojui:

- Tikslas: ${data.goal}
- Patirtis: ${data.experience}
- Lokacija: ${data.location}
- Įranga: ${data.equipment.join(", ") || "Kūno svoris"}
- Dienų per savaitę: ${data.daysPerWeek}
- Trukmė per sesiją: ${data.sessionMinutes} min
- Apribojimai / traumos: ${data.limitations || "nėra"}

KATALOGAS:
${catalog}

REIKALAVIMAI:
- Sukurk TIKSLIAI ${data.daysPerWeek} treniruočių dienas (day: 1..${data.daysPerWeek}).
- Kiekvienai dienai parink 4-6 efektyvius pratimus.
- Visą tekstą (pavadinimus, apšilimą, patarimus) rašyk ${langName} kalba.

Atsakyk TIK TIKSLIU JSON:
{
  "title": "8 Savaičių Progresyvi Programa",
  "summary": "Programos santrauka ${langName} kalba",
  "weeks": 8,
  "progression": "Progresyvaus perkrovimo taisyklės",
  "nutrition": "Mitybos gairės ir baltymų normos",
  "days": [
    {
      "day": 1,
      "title": "Viršutinė kūno dalis (Jėga)",
      "focus": "Krūtinė, Nugara, Pečiai",
      "warmup": "Dinaminis pečių juostos apšilimas",
      "cooldown": "Tempimo pratimai",
      "estimated_minutes": ${data.sessionMinutes},
      "exercises": [
        {
          "slug": "bench-press",
          "name": "Spaudimas štanga gulint",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "Mentės suvestos, kontroliuojama ekscentrika"
        }
      ]
    }
  ]
}`;

    const plan = await generateJson<GeneratedPlan>(null, {
      prompt,
      schema: PlanSchema,
    });

    await supabase.from("plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);

    const { data: inserted, error } = await supabase
      .from("plans")
      .insert({
        user_id: userId,
        title: plan.title,
        goal: data.goal,
        weeks: plan.weeks || 8,
        days_per_week: data.daysPerWeek,
        is_active: true,
        lang: data.lang,
        data: plan,
      })
      .select("id")
      .single();

    if (error) console.error("Plan save error:", error.message);

    await supabase
      .from("profiles")
      .update({
        goal: data.goal,
        experience: data.experience,
        location: data.location,
        equipment: data.equipment,
        days_per_week: data.daysPerWeek,
        session_minutes: data.sessionMinutes,
        locale: data.lang,
        onboarded: true,
      })
      .eq("id", userId);

    return { planId: inserted?.id || "local-plan-id", plan };
  });

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(1000),
        lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]).default("lt"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [snapshot, { data: history }] = await Promise.all([
      buildUserContext(supabase, userId),
      supabase
        .from("coach_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const priorTurns = (history ?? [])
      .slice()
      .reverse()
      .map((m) => `${m.role === "user" ? "Client" : "Coach"}: ${m.content}`)
      .join("\n");

    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const system = `Tu esi GYMS.LIFE, draugiškas, bet reiklus ir moksliškai pagrįstas jėgos treneris.
Atsakyk ${langName} kalba. Būk konkretus, lakoniškas (iki 150 žodžių), praktiškas.
Neteik medicininių diagnozių, nukreipk pas gydytoją esant skausmui ar traumai.
Atsakymuose remkis kliento duomenimis.

KLIENTO BIOMETRIJA IR TELEMETRIJA:
${contextForAi(snapshot)}
${priorTurns ? `\nPaskutinis pokalbis:\n${priorTurns}` : ""}`;

    const answer = await askFastTextAi({
      messages: [
        { role: "system", content: system },
        { role: "user", content: data.question },
      ],
      temperature: 0.3,
    });

    const { error: saveError } = await supabase.from("coach_messages").insert([
      { user_id: userId, role: "user", content: data.question, lang: data.lang },
      { user_id: userId, role: "coach", content: answer, lang: data.lang },
    ]);
    if (saveError) console.error("coach_messages insert failed", saveError.message);

    return { answer };
  });

export const listCoachMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(200).default(60) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("coach_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return {
      messages: (rows ?? []).slice().reverse().map((r) => ({
        id: r.id as string,
        role: r.role as "user" | "coach",
        content: r.content as string,
        createdAt: r.created_at as string,
      })),
    };
  });

export const clearCoachMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("coach_messages").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
