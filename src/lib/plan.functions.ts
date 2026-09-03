import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateOrchestratedJson, generateOrchestratedText } from "./ai-orchestrator.server";
import { parseCoachMessageHistory } from "./coach-message.schema";
import { serializeJson } from "./json.schema";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import {
  canonicalizeGeneratedPlanExercises,
  formatExerciseCatalogForAi,
  parseDemonstratedExerciseCatalog,
  selectPlanExerciseCatalog,
} from "./exercise-catalog.schema";
import { observeServerAction } from "./observability.server";
import { validateGeneratedTrainingPlan } from "./training-plan-generation.validation";
import { TrainingPlanDataSchema } from "./training-plan.schema";

// Draft/activation lifecycle: generation never changes the user's active program.
// Activation is handled separately by activate-plan.functions.ts.

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
  lang: SupportedLanguageSchema.default("lt"),
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
  progression: text(
    "Kas savaitę didinkite darbinį svorį arba pakartojimų skaičių išlaikant RPE 7-9.",
  ),
  nutrition: text(
    "Išlaikykite 1.8-2.2g/kg baltymų normą ir gerkite bent 2.5-3L vandens per dieną.",
  ),
  days: z.array(PlanDay),
});
export type GeneratedPlan = z.infer<typeof PlanSchema>;

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IntakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return observeServerAction(
      {
        eventName: "training_plan.generation",
        userId,
        failureCode: "TRAINING_PLAN_GENERATION_FAILED",
        metadata: {},
      },
      async () => {
        const { data: exercises, error: catalogError } = await supabase
          .from("exercises")
          .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty");
        const catalogExercises = parseDemonstratedExerciseCatalog(exercises);
        if (catalogError || catalogExercises.length === 0) {
          throw new Error("Exercise catalog is unavailable. Please try again shortly.");
        }
        const compatibleCatalog = selectPlanExerciseCatalog(catalogExercises, {
          equipment: data.equipment,
          location: data.location,
        });
        const catalog = formatExerciseCatalogForAi(compatibleCatalog);
        const catalogSlugs = compatibleCatalog.map((exercise) => exercise.slug);
        const langName = LANGUAGE_NAMES[data.lang];
        const prompt = `Tu esi GYMS.LIFE elitinis jėgos ir biomechanikos treneris.\nSukurk profesionalią, moksliškai pagrįstą treniruočių programą šiam vartotojui:\n\n- Tikslas: ${data.goal}\n- Patirtis: ${data.experience}\n- Lokacija: ${data.location}\n- Įranga: ${data.equipment.join(", ") || "Kūno svoris"}\n- Dienų per savaitę: ${data.daysPerWeek}\n- Trukmė per sesiją: ${data.sessionMinutes} min\n- Apribojimai / traumos: ${data.limitations || "nėra"}\n\nKATALOGAS:\n${catalog}\n\nREIKALAVIMAI:\n- Sukurk TIKSLIAI ${data.daysPerWeek} treniruočių dienas (day: 1..${data.daysPerWeek}).\n- Kiekvienai dienai parink 4-6 efektyvius pratimus.\n- Kiekvieno pratimo \`slug\` privalo būti pažodžiui nukopijuotas iš pirmo KATALOGAS eilutės lauko. Niekada nekurk naujo slug ir nekeisk jo tarpo, didžiosiomis raidėmis ar vertimu.\n- \`name\` turi atitikti to paties katalogo pratimo pavadinimą ${langName} kalba.\n- Visą tekstą (pavadinimus, apšilimą, patarimus) rašyk ${langName} kalba.\n\nAtsakyk TIK TIKSLIU JSON:\n{\n  "title": "8 Savaičių Progresyvi Programa",\n  "summary": "Programos santrauka ${langName} kalba",\n  "weeks": 8,\n  "progression": "Progresyvaus perkrovimo taisyklės",\n  "nutrition": "Mitybos gairės ir baltymų normos",\n  "days": []\n}`;
        const generated = await generateOrchestratedJson({
          task: "training-plan",
          supabase,
          userId,
          prompt,
          schema: PlanSchema,
        });
        const plan = TrainingPlanDataSchema.safeParse(generated);
        if (!plan.success) {
          throw new Error("Generated training plan is incomplete. Please try again.");
        }
        const canonicalPlan = canonicalizeGeneratedPlanExercises(
          plan.data,
          compatibleCatalog,
          data.lang === "lt" ? "lt" : "en",
        );
        validateGeneratedTrainingPlan(canonicalPlan, data.daysPerWeek, catalogSlugs);

        const { data: inserted, error } = await supabase
          .from("plans")
          .insert({
            user_id: userId,
            title: canonicalPlan.title,
            goal: data.goal,
            weeks: plan.data.weeks,
            days_per_week: data.daysPerWeek,
            is_active: false,
            lang: data.lang,
            data: serializeJson(canonicalPlan),
          })
          .select("id")
          .single();
        if (error) throw new Error(`Plan save error: ${error.message}`);
        const { error: profileError } = await supabase
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
        if (profileError) throw new Error(`Profile save error: ${profileError.message}`);
        return { planId: inserted.id, plan: canonicalPlan };
      },
    );
  });

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(1000),
        lang: SupportedLanguageSchema.default("lt"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: history } = await supabase
      .from("coach_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const priorTurns = (history ?? [])
      .slice()
      .reverse()
      .map((m) => `${m.role === "user" ? "Client" : "Coach"}: ${m.content}`)
      .join("\n");
    const langName = LANGUAGE_NAMES[data.lang];
    const system = `Tu esi GYMS.LIFE, draugiškas, bet reiklus ir moksliškai pagrįstas jėgos treneris.\nAtsakyk ${langName} kalba. Būk konkretus, lakoniškas (iki 150 žodžių), praktiškas.\nNeteik medicininių diagnozių, nukreipk pas gydytoją esant skausmui ar traumai.\nAtsakymuose remkis GYMS.LIFE centriniu vartotojo kontekstu.${priorTurns ? `\n\nPaskutinis pokalbis:\n${priorTurns}` : ""}`;
    const answer = await generateOrchestratedText({
      task: "coach.ask",
      supabase,
      userId,
      system,
      prompt: data.question,
      temperature: 0.3,
    });
    const { error: saveError } = await supabase.from("coach_messages").insert([
      { user_id: userId, role: "user", content: data.question, lang: data.lang },
      { user_id: userId, role: "coach", content: answer, lang: data.lang },
    ]);
    if (saveError) throw new Error("Could not save this coach conversation.");
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
    const orderedRows = (rows ?? []).slice().reverse();
    return {
      messages: parseCoachMessageHistory(orderedRows),
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
