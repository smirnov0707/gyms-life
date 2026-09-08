import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import {
  formatExerciseCatalogForAi,
  parseDemonstratedExerciseCatalog,
  selectPlanExerciseCatalog,
} from "./exercise-catalog.schema";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";

const BuildWorkoutInputSchema = z.object({
  request: z.string().trim().min(3).max(500),
  lang: SupportedLanguageSchema.default("lt"),
  minutes: z.coerce.number().int().min(10).max(150).default(45),
});

const WorkoutBlockSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  sets: z.coerce.number().int().min(1).max(12),
  reps: z.string().trim().min(1).max(40),
  rest_seconds: z.coerce.number().int().min(0).max(600),
  muscle: z.string().trim().max(100).nullable().default(null),
  note: z.string().trim().max(300).nullable().default(null),
});

const RequestedWorkoutSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  total_minutes: z.coerce.number().int().min(10).max(150),
  warmup: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
  blocks: z.array(WorkoutBlockSchema).min(1).max(12),
  cooldown: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
  tips: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
});

export type RequestedWorkout = Omit<z.infer<typeof RequestedWorkoutSchema>, "blocks"> & {
  blocks: Array<z.infer<typeof WorkoutBlockSchema> & { hasPage: boolean }>;
};

export const buildRequestedWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => BuildWorkoutInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<RequestedWorkout> => {
    const [
      { data: catalogExercises, error: catalogError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      context.supabase
        .from("exercises")
        .select("slug, name_en, name_lt, muscle_group, equipment, location, difficulty")
        .order("slug")
        .limit(400),
      context.supabase
        .from("profiles")
        .select("equipment, location, limitations")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    const demonstratedCatalog = parseDemonstratedExerciseCatalog(catalogExercises);
    if (catalogError || demonstratedCatalog.length === 0) {
      throw new Error("Exercise catalog is unavailable. Please try again shortly.");
    }
    // A profile we could not read is not a profile with no equipment in it.
    // Building a workout from the whole catalog for somebody whose kit we
    // failed to load is how an athlete at home with a band is handed a barbell
    // session, so this refuses rather than guesses.
    if (profileError) {
      throw new Error("Your training profile is unavailable. Please try again shortly.");
    }

    // The system prompt has always said "Respect limitations and equipment
    // from the user context". There was no user context: this handler read the
    // catalog and nothing else, so the model was told to respect data it had
    // never been given, and the slug check accepted every exercise that
    // exists. An athlete training at home with a resistance band could ask for
    // a leg session and be handed a barbell squat, with every check passing.
    const selection = selectPlanExerciseCatalog(demonstratedCatalog, {
      equipment: profile?.equipment ?? [],
      location: profile?.location ?? "both",
    });
    const catalog = formatExerciseCatalogForAi(selection.exercises);
    const limitations = profile?.limitations?.trim() ?? "";

    const language = LANGUAGE_NAMES[data.lang];
    const workout = await generateOrchestratedJson({
      task: "workout-request",
      supabase: context.supabase,
      userId: context.userId,
      system: `You are GYMS.LIFE's evidence-based training planner. Write in ${language}.

Safety rules:
- Do not diagnose injuries or prescribe medical treatment.
- Respect limitations and equipment from the user context.
- Choose conservative loading when recovery information is absent or poor.
- Return a practical single-session workout that fits the requested duration.
- Use ONLY exercise slugs copied exactly from the catalog below.`,
      prompt: `Exercise catalog (slug | English / Lithuanian | muscle | equipment | location | difficulty).
${
  // Only claim the narrowing when it actually happened. Too few compatible
  // exercises means the whole catalog was handed over, and telling the model
  // it has been filtered when it has not is the same lie one level up.
  selection.equipmentConstrained
    ? "This catalog has already been narrowed to what this person can use; nothing outside it is available:"
    : `Too few exercises match this person's equipment, so this is the full catalog. Their equipment: ${profile?.equipment?.join(", ") || "none recorded"}. Prefer what they can actually use:`
}
${catalog}

Reported limitations or injuries: ${limitations || "none reported"}

Build one workout from this user request: ${data.request}

Return this exact JSON shape:
{
  "title":"string",
  "summary":"string",
  "total_minutes":${data.minutes},
  "warmup":["string"],
  "blocks":[{
    "slug":"stable exercise slug",
    "name":"string",
    "sets":3,
    "reps":"8-10",
    "rest_seconds":90,
    "muscle":"string or null",
    "note":"string or null"
  }],
  "cooldown":["string"],
  "tips":["string"]
}`,
      schema: RequestedWorkoutSchema,
      maxOutputTokens: 2400,
    });

    // The pool the model was given, not the whole catalog. Checking against
    // every exercise that exists makes the check pass for equipment the
    // athlete does not own, leaving the prompt's own safety rule as the only
    // guard — which is the model policing itself.
    const knownSlugs = new Set(selection.exercises.map((exercise) => exercise.slug));
    const unavailableSlugs = [
      ...new Set(workout.blocks.map((block) => block.slug).filter((slug) => !knownSlugs.has(slug))),
    ];
    if (unavailableSlugs.length > 0) {
      throw new Error("Generated workout contains exercises outside the available catalog.");
    }

    return {
      ...workout,
      blocks: workout.blocks.map((block) => ({
        ...block,
        hasPage: true,
      })),
    };
  });
