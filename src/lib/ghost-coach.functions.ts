import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { buildUserContext } from "./user-context.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GhostCoachInput = z.object({ lang: z.string().default("lt") });

export const getProactiveCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => GhostCoachInput.parse(data))
  .handler(async ({ data, context: authContext }) => {
    const context = await buildUserContext(authContext.supabase, authContext.userId);
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const prompt = `Tu esi proaktyvus elitinis AI treneris „Ghost Coach“ platformoje GYMS.LIFE.
Sportininko dabartinė būklė ir kontekstas:
${JSON.stringify(context, null, 2)}

Sugeneruok trumpą, proaktyvią, profesionalią dienos įžvalgą sportininkui.
Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "headline": "Taikli 1 sakinio antraštė ${langName} kalba",
  "readinessScore": 88,
  "fatigueStatus": "Optimalus / Padidėjęs / Reikia poilsio",
  "trainingAdvice": "Konkretus patarimas šiandienos treniruotei",
  "nutritionAdvice": "Konkretus mitybos veiksmas šiandienai",
  "recommendedAction": "Konkretus veiksmas šiandienai"
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
      return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch {
      return {
        ok: true,
        headline: data.lang === "lt" ? "Jūsų kūnas pasiruošęs progresyviai perkrovai" : "Body primed for progressive overload",
        readinessScore: 90,
        fatigueStatus: "Optimalus",
        trainingAdvice: data.lang === "lt" ? "Sutelkkite dėmesį į pagrindinių pratimų intensyvumą." : "Focus on compound exercise intensity.",
        nutritionAdvice: data.lang === "lt" ? "Užtikrinkite pakankamą baltymų kiekį pagal savo tikslą." : "Ensure sufficient protein intake for your goal.",
        recommendedAction: data.lang === "lt" ? "Atlikite pilną apšilimą prieš pagrindines serijas." : "Complete dynamic warmup.",
      };
    }
  });
