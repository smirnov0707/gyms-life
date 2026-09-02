import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson } from "./ai-json.server";
import { createOrchestratedAi } from "./ai-orchestrator.server";

const BuildWorkoutInputSchema = z.object({
  request: z.string().trim().min(3).max(500),
  lang: z.enum(["lt", "en"]).default("lt"),
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
    const { provider, contextPrompt } = await createOrchestratedAi(
      "workout-request.functions",
      context.supabase,
      context.userId,
    );

    const language = data.lang === "lt" ? "Lithuanian" : "English";
    const workout = await generateJson(provider("google/gemini-2.5-flash"), {
      userId: context.userId,
      system: `You are GYMS.LIFE's evidence-based training planner. Write in ${language}.

Safety rules:
- Do not diagnose injuries or prescribe medical treatment.
- Respect limitations and equipment from the user context.
- Choose conservative loading when recovery information is absent or poor.
- Return a practical single-session workout that fits the requested duration.

${contextPrompt}`,
      prompt: `Build one workout from this user request: ${data.request}

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

    const slugs = workout.blocks.map((block) => block.slug);
    const { data: knownExercises, error } = await context.supabase
      .from("exercises")
      .select("slug")
      .in("slug", slugs);
    if (error) throw new Error("Could not verify generated exercises.");

    const knownSlugs = new Set((knownExercises ?? []).map((exercise) => exercise.slug));
    return {
      ...workout,
      blocks: workout.blocks.map((block) => ({
        ...block,
        hasPage: knownSlugs.has(block.slug),
      })),
    };
  });
