import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ForecastInput = z.object({ lang: z.string().default("lt") });

export const forecastProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ForecastInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const { data: sets } = await supabase
      .from("set_logs")
      .select("created_at, exercise_slug, exercise_name, weight_kg, reps, rpe")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const rows = (sets ?? []).filter((r) => (r.weight_kg ?? 0) > 0 && (r.reps ?? 0) > 0);
    if (rows.length < 6) return { ok: false as const, lifts: [], summary: "", actions: [] };

    const { buildLiftHistory } = await import("./forecast.server");
    const history = buildLiftHistory(rows);

    const { generateJson } = await import("./ai-json.server");
    const { createAiRouterProvider } = await import("./ai-gateway.server");
    const { LANG_NAMES } = await import("./plan-i18n.server");
    const gateway = createAiRouterProvider("forecast.functions");

    const schema = z.object({
      lifts: z.array(
        z.object({
          name: z.string(),
          current1rm: z.number(),
          projected4w: z.number(),
          projected12w: z.number(),
          nextWorkingWeight: z.number(),
          trend: z.enum(["rising", "flat", "falling"]),
          plateauRisk: z.number(),
          note: z.string(),
        }),
      ),
      summary: z.string(),
      actions: z.array(z.string()),
    });

    const language = LANG_NAMES[data.lang] ?? "English";
    const system = `You are a strength coach analysing a lifter's real training log.
For each of the main lifts given, estimate the current 1RM (Epley from the best recent sets), a realistic 4-week and 12-week projection based on the observed rate of progress and training frequency, and the next working weight to use.
Be conservative: untrained lifters progress faster, experienced lifters much slower. plateauRisk is 0-100. Weights in kilograms, rounded to 0.5.
Write "note", "summary" and "actions" entirely in ${language}. Max 3 actions, one sentence each.

Return EXACTLY this JSON shape, using these exact property names:
{"lifts":[{"name":"Squat","current1rm":100,"projected4w":105,"projected12w":115,"nextWorkingWeight":85,"trend":"rising","plateauRisk":25,"note":"..."}],"summary":"...","actions":["...","..."]}
"trend" must be one of "rising", "flat", "falling". Never rename, omit or nest these keys.`;

    const result = await generateJson(gateway("google/gemini-3.1-flash-lite"), {
      system,
      schema,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: JSON.stringify(history) }],
        },
      ],
    });

    return { ok: true as const, ...result };
  });
