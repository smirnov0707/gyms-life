import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { getUserBiometricContext } from "./user-context.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GhostCoachInput = z.object({
  lang: z.string().default("lt"),
});

export const getProactiveCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => GhostCoachInput.parse(data))
  .handler(async ({ data, context: auth }) => {
    const context = await getUserBiometricContext(auth.supabase, auth.userId);
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";

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
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      return JSON.parse(
        raw
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch (err: any) {
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
