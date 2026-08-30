import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LANGS = ["lt", "en", "ru", "uk", "pl", "de", "es", "fr"] as const;

const RequestInput = z.object({
  request: z.string().min(3).max(400),
  lang: z.enum(LANGS).default("lt"),
  minutes: z.coerce.number().int().min(10).max(150).default(45),
});

const num = (fallback: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? fallback : v),
    z.coerce.number().default(fallback),
  );

const WorkoutSchema = z.object({
  title: z.string().default(""),
  summary: z.string().default(""),
  total_minutes: num(45),
  warmup: z.array(z.string()).default([]),
  blocks: z
    .array(
      z.object({
        slug: z.string().default(""),
        name: z.string().default(""),
        muscle: z.string().default(""),
        sets: num(3),
        reps: z.union([z.string(), z.number()]).default("8-12").transform(String),
        rest_seconds: num(90),
        note: z.string().default(""),
      }),
    )
    .default([]),
  cooldown: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
});

export type RequestedWorkout = Omit<z.infer<typeof WorkoutSchema>, "blocks"> & {
  blocks: (z.infer<typeof WorkoutSchema>["blocks"][number] & { hasPage: boolean })[];
};

/** Free-text training request → a concrete, catalog-backed workout. */
export const buildRequestedWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: exercises }] = await Promise.all([
      supabase
        .from("profiles")
        .select("experience, location, equipment, limitations, session_minutes, gender")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("exercises")
        .select("slug, name_lt, name_en, muscle_group, equipment, location, difficulty"),
    ]);

    const catalog = exercises ?? [];
    const equipment = (profile?.equipment ?? []) as string[];
    const allowed = catalog.filter(
      (e) =>
        (!equipment.length || equipment.includes(e.equipment) || e.equipment === "bodyweight") &&
        (!profile?.location ||
          profile.location === "both" ||
          e.location === "both" ||
          e.location === profile.location),
    );
    const pool = (allowed.length >= 30 ? allowed : catalog).slice(0, 400);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("workout-request.functions");
    const langName = LANG_NAMES[data.lang] ?? "English";

    const prompt = `You are an elite strength & conditioning coach. Build ONE concrete training session for this request.

CLIENT REQUEST (verbatim): "${data.request}"
Time available: ${data.minutes} minutes
Experience: ${profile?.experience ?? "beginner"} | Location: ${profile?.location ?? "gym"} | Equipment: ${equipment.join(", ") || "bodyweight"}
Limitations/injuries: ${profile?.limitations || "none"}

CATALOG (slug | en / lt | muscle | equipment | difficulty)
${pool.map((e) => `${e.slug} | ${e.name_en} / ${e.name_lt} | ${e.muscle_group} | ${e.equipment} | ${e.difficulty}`).join("\n")}

RULES
- 5-8 exercises, ordered as they should be performed (compound first).
- Use ONLY slugs copied exactly from the catalog. Never invent a slug.
- Respect equipment, location, limitations and the available time.
- sets 2-5; reps a short string like "8-10" or "40 s"; rest_seconds 30-180.
- Total of sets*(work+rest) must roughly fit ${data.minutes} minutes including warmup and cooldown.
- 3-5 warmup items and 2-4 cooldown items, each one short sentence.
- 2-4 tips: load progression, tempo, or safety.
- ALL user-visible text (title, summary, name, muscle, note, warmup, cooldown, tips) in ${langName}.

RETURN JSON: {"title":"","summary":"","total_minutes":45,"warmup":[""],"blocks":[{"slug":"","name":"","muscle":"","sets":3,"reps":"8-10","rest_seconds":90,"note":""}],"cooldown":[""],"tips":[""]}`;

    let out: z.infer<typeof WorkoutSchema>;
    try {
      out = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
        prompt,
        schema: WorkoutSchema,
        maxOutputTokens: 3000,
      });
    } catch {
      throw new Error("AI could not build the workout. Please try again.");
    }

    const bySlug = new Map(catalog.map((e) => [e.slug, e]));
    const seen = new Set<string>();
    const blocks = out.blocks
      .filter((b) => b.slug && !seen.has(b.slug) && seen.add(b.slug) !== undefined)
      .slice(0, 10)
      .map((b) => {
        const row = bySlug.get(b.slug);
        return {
          ...b,
          name: b.name || (row ? (data.lang === "lt" ? row.name_lt : row.name_en) : b.slug),
          muscle: b.muscle || row?.muscle_group || "",
          sets: Math.min(6, Math.max(1, Math.round(b.sets))),
          rest_seconds: Math.min(240, Math.max(20, Math.round(b.rest_seconds))),
          hasPage: !!row,
        };
      });

    return {
      ...out,
      total_minutes: Math.min(180, Math.max(10, Math.round(out.total_minutes))),
      blocks,
    } as RequestedWorkout;
  });
