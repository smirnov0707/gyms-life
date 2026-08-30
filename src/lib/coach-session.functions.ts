import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LangSchema = z.string().default("lt");

/** Warm-up drills we have verified technique clips for. */
export const WARMUP_SLUGS = [
  "cat-cow",
  "thoracic-rotation",
  "bird-dog",
  "dead-bug",
  "glute-bridge",
  "single-leg-glute-bridge",
  "hip-flexor-stretch",
  "couch-stretch",
  "cossack-squat",
  "bodyweight-squat",
  "goblet-squat",
  "reverse-lunge",
  "db-walking-lunge",
  "band-lateral-walk",
  "band-pull-apart",
  "face-pull",
  "plank",
  "side-plank",
  "plank-shoulder-tap",
  "good-morning",
  "kettlebell-swing",
  "jumping-jack",
  "jump-rope",
  "calf-raise",
  "treadmill-sprint",
  "assault-bike",
] as const;

const DrillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  dose: z.string(),
  focus: z.string(),
  why: z.string(),
});

const WarmupSchema = z.object({
  headline: z.string(),
  minutes: z.number(),
  drills: z.array(DrillSchema).min(3).max(6),
});

const WarmupInput = z.object({
  focus: z.string().default(""),
  exercises: z.array(z.string()).default([]),
  lang: LangSchema,
});

/** Smart warm-up: built from today's movements, readiness and recent soreness. */
export const getSmartWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WarmupInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: checkin }, { data: recent }] = await Promise.all([
      supabase
        .from("daily_checkins")
        .select("readiness_score, soreness, sleep_hours, energy")
        .eq("user_id", userId)
        .order("checkin_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("title, started_at, total_volume")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(4),
    ]);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("coach-session.functions");

    const ask = () =>
      generateJson(gateway("google/gemini-3.1-flash-lite"), {
        schema: WarmupSchema,
        system: `You are a strength coach designing a specific warm-up and mobility ramp for one training session.
Answer entirely in ${LANG_NAMES[data.lang] ?? "English"}.
Pick 4-5 drills. Each "slug" MUST be one of this exact list: ${WARMUP_SLUGS.join(", ")}.
"name" = drill name in the answer language, "dose" = sets/reps or seconds, "focus" = joint or muscle prepared,
"why" = one short sentence tying the drill to today's exercises, soreness or readiness. "minutes" = total time.
Order drills from general to specific. No greetings.
Return ONLY strict, minified JSON — every key and every string value wrapped in double quotes, no trailing commas, no comments, no markdown, and never a colon inside an unquoted value. Shape:
{"headline":"","minutes":8,"drills":[{"slug":"","name":"","dose":"","focus":"","why":""}]}`,
        prompt: `Today's focus: ${data.focus || "general"}
Today's exercises: ${data.exercises.join(", ") || "unknown"}
Latest check-in: ${JSON.stringify(checkin ?? {})}
Recent sessions: ${JSON.stringify(recent ?? [])}`,
        maxOutputTokens: 2000,
      });

    let parsed: Awaited<ReturnType<typeof ask>>;
    try {
      parsed = await ask();
    } catch {
      try {
        parsed = await ask();
      } catch {
        const { fallbackWarmup } = await import("./warmup-fallback.server");
        parsed = fallbackWarmup(data.focus, data.exercises, data.lang);
      }
    }

    const drills = parsed.drills.filter((d) =>
      (WARMUP_SLUGS as readonly string[]).includes(d.slug),
    );

    const safe = drills.length
      ? { ...parsed, drills }
      : { ...parsed, ...(await import("./warmup-fallback.server")).fallbackWarmup(data.focus, data.exercises, data.lang) };

    return {
      ...safe,
      readiness: checkin?.readiness_score ?? null,
    };
  });


/* ------------------------------------------------------------------ */
/* LIVE SET ADVICE — next-set load & volume from RPE + history         */
/* ------------------------------------------------------------------ */

const SetInput = z.object({
  exerciseSlug: z.string().min(1),
  exerciseName: z.string().min(1),
  targetReps: z.string().default(""),
  setNumber: z.number().min(1),
  totalSets: z.number().min(1),
  doneSets: z
    .array(z.object({ weight: z.number().nullable(), reps: z.number().nullable(), rpe: z.number().nullable() }))
    .default([]),
  lang: LangSchema,
});

const AdviceSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  targetRir: z.number(),
  cue: z.string(),
  why: z.string(),
  evidence: z.string(),
});

export const getSetAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: history }, { data: checkin }] = await Promise.all([
      supabase
        .from("set_logs")
        .select("weight_kg, reps, rpe, created_at")
        .eq("user_id", userId)
        .eq("exercise_slug", data.exerciseSlug)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("daily_checkins")
        .select("readiness_score, load_modifier, soreness")
        .eq("user_id", userId)
        .order("checkin_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("coach-session.functions");

    const parsed = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      schema: AdviceSchema,
      system: `You are a live strength coach calling the next set during a workout.
Answer entirely in ${LANG_NAMES[data.lang] ?? "English"}.
Return the load in kg ("weight", rounded to 2.5 kg, null only if the lift is bodyweight), "reps",
"targetRir" (reps in reserve, 0-4), a short "cue" (max 12 words), "why" (one sentence explaining the decision),
and "evidence" (a literal citation of the numbers you used, e.g. "60 kg x 8 @ RPE 9 · last week 57.5 kg").
Use RPE/RIR autoregulation: RPE 9-10 on the previous set means hold or drop load; RPE <=7 means add 2.5-5 kg
or a rep. Respect readiness: a low score means keep volume conservative. Never invent numbers that are not in the data.`,
      prompt: `Exercise: ${data.exerciseName} (${data.exerciseSlug})
Planned reps: ${data.targetReps}
Upcoming set ${data.setNumber} of ${data.totalSets}
Sets already completed today: ${JSON.stringify(data.doneSets)}
Recent logged sets (newest first): ${JSON.stringify(history ?? [])}
Readiness check-in: ${JSON.stringify(checkin ?? {})}`,
      maxOutputTokens: 900,
    });

    return parsed;
  });

/* ------------------------------------------------------------------ */
/* SESSION DEBRIEF — what worked, what to change next time             */
/* ------------------------------------------------------------------ */

const DebriefInput = z.object({
  title: z.string().default(""),
  durationSeconds: z.number().default(0),
  volume: z.number().default(0),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        sets: z.array(
          z.object({
            weight: z.number().nullable(),
            reps: z.number().nullable(),
            rpe: z.number().nullable(),
          }),
        ),
      }),
    )
    .default([]),
  lang: LangSchema,
});

const DebriefSchema = z.object({
  headline: z.string(),
  wins: z.array(z.string()).min(1).max(4),
  fixes: z.array(z.string()).min(1).max(4),
  nextSession: z.string(),
  evidence: z.array(z.string()).min(1).max(4),
});

export const getSessionDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DebriefInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: previous } = await supabase
      .from("workout_sessions")
      .select("title, total_volume, duration_seconds, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("coach-session.functions");

    return await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      schema: DebriefSchema,
      system: `You are the athlete's coach writing a short debrief right after the session.
Answer entirely in ${LANG_NAMES[data.lang] ?? "English"}.
"headline" = one sentence verdict. "wins" = what actually worked (each max 14 words).
"fixes" = what to adjust next time (load, reps, tempo, rest, RPE targets).
"nextSession" = one concrete instruction for the same workout next week.
"evidence" = literal citations from the data, e.g. "Bench 60 kg x 8 @ RPE 9" or "Volume 4 210 kg vs 3 980 kg".
Never invent numbers.`,
      prompt: `Session: ${data.title}
Duration: ${Math.round(data.durationSeconds / 60)} min · volume ${Math.round(data.volume)} kg
Logged sets: ${JSON.stringify(data.exercises)}
Previous sessions: ${JSON.stringify(previous ?? [])}`,
      maxOutputTokens: 1600,
    });
  });
