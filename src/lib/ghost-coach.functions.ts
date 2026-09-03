import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GhostCoachInput = z.object({
  lang: SupportedLanguageSchema.default("lt"),
});

const GhostCoachInsightSchema = z
  .object({
    headline: z.string().trim().min(1).max(220),
    trainingAdvice: z.string().trim().min(1).max(700),
    nutritionAdvice: z.string().trim().min(1).max(700),
    recommendedAction: z.string().trim().min(1).max(350),
  })
  .strict();

export type GhostCoachInsight = z.infer<typeof GhostCoachInsightSchema>;

/**
 * A legacy secondary coach surface. It now uses only the canonical,
 * consent-aware orchestrator context and deliberately has no fabricated
 * success response when an AI worker is unavailable.
 */
export const getProactiveCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => GhostCoachInput.parse(data))
  .handler(async ({ data, context: auth }) => {
    const { buildUserContext } = await import("./user-context.server");
    const centralUserContext = await buildUserContext(auth.supabase, auth.userId);
    const langName = LANGUAGE_NAMES[data.lang];

    return generateOrchestratedJson({
      task: "ghost-coach",
      supabase: auth.supabase,
      userId: auth.userId,
      centralUserContext,
      system:
        "You are GYMS.LIFE's internal communication worker. Never invent measurements, trends, readiness, outcomes, or confidence. When the context has a data gap, say what is unknown and recommend only a safe next logging or recovery action.",
      prompt: `Write one concise daily coaching note in ${langName}. Use only the appended GYMS.LIFE central user context. Do not mention AI, providers, or hidden systems. Return exactly the requested JSON.`,
      schema: GhostCoachInsightSchema,
      maxOutputTokens: 700,
    });
  });
