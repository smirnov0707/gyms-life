import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IntakeSchema = z.object({
  goal: z.string(),
  experience: z.string(),
  location: z.string(),
  equipment: z.array(z.string()),
  daysPerWeek: z.number(),
  sessionMinutes: z.number(),
  age: z.number().nullable(),
  gender: z.string().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
  limitations: z.string().nullable(),
  lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]),
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
  slug: z.string(),
  name: text(""),
  sets: num(3),
  reps: text("8-12"),
  rest_seconds: num(90),
  notes: text(""),
});

const PlanDay = z.object({
  day: num(1),
  title: text(""),
  focus: text(""),
  warmup: text(""),
  cooldown: text(""),
  estimated_minutes: num(45),
  exercises: z.array(PlanExercise).default([]),
});

const PlanSchema = z.object({
  title: text("GYMS.LIFE"),
  summary: text(""),
  weeks: num(8),
  progression: text(""),
  nutrition: text(""),
  days: z.array(PlanDay),
});

export type GeneratedPlan = z.infer<typeof PlanSchema>;

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IntakeSchema.parse(input))
  .handler(async ({ data, context }) => {

    const { supabase, userId } = context;

    const { data: exercises } = await supabase
      .from("exercises")
      .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty");

    const catalog = (exercises ?? [])
      .map(
        (e) =>
          `${e.slug} | ${e.name_en} / ${e.name_lt} | ${e.muscle_group} | ${e.equipment} | ${e.location} | ${e.difficulty}`,
      )
      .join("\n");

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("plan.functions");

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const langName = LANG_NAMES[data.lang] ?? "English";
    const prompt = `You are an elite strength & conditioning coach. Build a personalised training plan.

CLIENT
- Goal: ${data.goal}
- Experience: ${data.experience}
- Training location: ${data.location}
- Available equipment: ${data.equipment.join(", ") || "bodyweight only"}
- Days per week: ${data.daysPerWeek}
- Minutes per session: ${data.sessionMinutes}
- Age: ${data.age ?? "n/a"}, gender: ${data.gender ?? "n/a"}
- Height: ${data.heightCm ?? "n/a"} cm, weight: ${data.weightKg ?? "n/a"} kg, target weight: ${data.targetWeightKg ?? "n/a"} kg
- Injuries / limitations: ${data.limitations || "none reported"}

EXERCISE CATALOG (slug | name | muscle group | equipment | location | difficulty)
${catalog}

RULES
- Produce exactly ${data.daysPerWeek} training days, numbered 1..${data.daysPerWeek}.
- Use ONLY slugs from the catalog. Copy the slug exactly.
- Respect the equipment and location: never program equipment the client does not have.
- Respect injuries: avoid contraindicated movements and say so in the notes.
- 4-7 exercises per day, total time close to ${data.sessionMinutes} minutes.
- reps is a short string like "8-10" or "30-45 s".
- Balance muscle groups across the week, and match volume and intensity to the goal and experience level.
- "progression" explains week-by-week progression over the whole block.
- "nutrition" is ONE string with 3-4 concrete nutrition pointers for this goal (use " • " to separate them, not an array).
- Write ALL human-readable text (title, summary, focus, warmup, cooldown, notes, progression, nutrition, exercise name) in ${langName}.

RETURN EXACTLY THIS JSON SHAPE (all keys required):
{"title":"string","summary":"string","weeks":8,"progression":"string","nutrition":"string","days":[{"day":1,"title":"string","focus":"string","warmup":"string","cooldown":"string","estimated_minutes":${data.sessionMinutes},"exercises":[{"slug":"catalog-slug","name":"string","sets":4,"reps":"8-10","rest_seconds":90,"notes":"string"}]}]}`;

    let plan: GeneratedPlan;
    try {
      plan = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        prompt,
        schema: PlanSchema,
      });
    } catch (error) {
      console.error("generatePlan failed", error);
      const message = error instanceof Error ? error.message : "";
      if (message === "AI_CREDITS" || message === "AI_RATE_LIMIT") throw new Error(message);
      throw new Error("AI could not build a valid plan. Please try again.");
    }

    const validSlugs = new Set((exercises ?? []).map((e) => e.slug));
    plan.days = plan.days.map((d) => ({
      ...d,
      exercises: d.exercises.filter((e) => validSlugs.has(e.slug)).slice(0, 8),
    }));

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

    if (error) throw new Error(error.message);

    await supabase
      .from("profiles")
      .update({
        goal: data.goal,
        experience: data.experience,
        location: data.location,
        equipment: data.equipment,
        days_per_week: data.daysPerWeek,
        session_minutes: data.sessionMinutes,
        birth_year: data.age ? new Date().getFullYear() - data.age : null,
        gender: data.gender,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        target_weight_kg: data.targetWeightKg,
        limitations: data.limitations,
        locale: data.lang,
        onboarded: true,
      })
      .eq("id", userId);

    return { planId: inserted.id as string };
  });

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(1000),
        lang: z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { buildUserSnapshot, snapshotToPrompt } = await import("./user-context.server");
    const [snapshot, { data: history }] = await Promise.all([
      buildUserSnapshot(supabase, userId),
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

    const { streamText } = await import("ai");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const gateway = createAiRouterProvider("plan.functions");

    const { LANG_NAMES } = await import("./plan-i18n.server");
    const result = streamText({
      model: gateway("google/gemini-3.1-flash-lite"),
      system: `You are GYMS.LIFE, a friendly but rigorous strength coach inside a training app.
Answer in ${LANG_NAMES[data.lang] ?? "English"}. Be concise (max ~180 words), concrete and practical.
Never give medical diagnoses; recommend a doctor for pain or injuries.
You can see the client's full app data below. Always ground your answer in it and, when useful, point the client to the right screen of the app: dashboard (/app), exercise library (/exercises), technique scanner (/ar), meal plan (/meal-plan), food diary (/nutrition), supplements (/supplements), progress & body scan (/progress), readiness check-in (/readiness), reminders (/reminders).

CLIENT DATA
${snapshotToPrompt(snapshot)}
${priorTurns ? `\nRecent conversation:\n${priorTurns}` : ""}`,
      prompt: data.question,
    });


    const answer = await result.text;

    const { error: saveError } = await supabase.from("coach_messages").insert([
      { user_id: userId, role: "user", content: data.question, lang: data.lang },
      { user_id: userId, role: "coach", content: answer, lang: data.lang },
    ]);
    if (saveError) console.error("coach_messages insert failed", saveError.message);

    return { answer };
  });

export const listCoachMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
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

