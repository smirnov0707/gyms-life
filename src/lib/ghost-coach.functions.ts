import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { getUserBiometricContext } from "./user-context.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GhostCoachInput = z.object({
  lang: SupportedLanguageSchema.default("lt"),
});

const GhostCoachInsightSuccessSchema = z.object({
  ok: z.literal(true),
  headline: z.string().trim().min(1).max(300),
  readinessScore: z.coerce.number().finite().min(0).max(100),
  fatigueStatus: z.string().trim().min(1).max(120),
  trainingAdvice: z.string().trim().min(1).max(1_000),
  nutritionAdvice: z.string().trim().min(1).max(1_000),
  recommendedAction: z.string().trim().min(1).max(500),
});

export type GhostCoachInsight = z.infer<typeof GhostCoachInsightSuccessSchema>;

export const getProactiveCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => GhostCoachInput.parse(data))
  .handler(async ({ data, context: auth }) => {
    const context = await getUserBiometricContext(auth.supabase, auth.userId);
    const langName = LANGUAGE_NAMES[data.lang];

    const prompt = `Tu esi proaktyvus elitinis AI treneris „Ghost Coach“ platformoje GYMS.LIFE.
Sportininko dabartinė būklė ir kontekstas:
    - Suvalgyta šiandien: ${context.todayNutrition.calories} kcal, ${context.todayNutrition.proteinG}g baltymų.
    - Tikslas: ${context.activeGoal}.
    - Paskutinė treniruotė: ${context.recentWorkout?.focus ?? "Nėra duomenų"}, RPE: ${context.recentWorkout?.avgRpe ?? 7}, Nuovargis: ${context.recentWorkout?.fatigueLevel ?? "low"}.

Sugeneruok trumpą, proaktyvią, profesionalią dienos įžvalgą sportininkui:
Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "headline": "Taikli 1 sakinio antraštė ${langName} kalba",
  "readinessScore": 88,
  "fatigueStatus": "Optimalus / Padidėjęs / Reikia poilsio",
  "trainingAdvice": "Konkretus patarimas šiandienos treniruotei",
  "nutritionAdvice": "Konkretus mitybos veiksmas šiandienai",
  "recommendedAction": "Pvz. Padidinti angliavandenius prieš treniruotę arba pridėti 1 seriją"
}`;

    try {
      return await generateOrchestratedJson({
        task: "ghost-coach",
        supabase: auth.supabase,
        userId: auth.userId,
        system: "Atsakyk TIK griežtu JSON formatu.",
        prompt,
        schema: GhostCoachInsightSuccessSchema,
      });
    } catch {
      return {
        ok: true,
        headline:
          data.lang === "lt"
            ? "Jūsų kūnas pasiruošęs progresyviai perkrovai"
            : "Body primed for progressive overload",
        readinessScore: 90,
        fatigueStatus: "Optimalus",
        trainingAdvice:
          data.lang === "lt"
            ? "Sutelkkite dėmesį į pagrindinių pratimų intensyvumą."
            : "Focus on compound exercise intensity.",
        nutritionAdvice:
          data.lang === "lt"
            ? "Užtikrinkite bent 2g baltymų kilogramui kūno svorio."
            : "Hit at least 2g protein per kg bodyweight.",
        recommendedAction:
          data.lang === "lt"
            ? "Atlikite pilną apšilimą prieš pagrindines serijas."
            : "Complete dynamic warmup.",
      };
    }
  });
