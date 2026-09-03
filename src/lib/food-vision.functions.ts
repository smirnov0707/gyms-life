import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getSafeAiErrorCode, SAFE_AI_ERROR_CODES, type SafeAiErrorCode } from "./ai-error";
import { generateOrchestratedJson } from "./ai-orchestrator.server";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";
import { NutritionMacrosSchema, normalizeNutritionLogDraft } from "./nutrition-log.schema";

const AnalyzeInput = z.object({
  image: z
    .string()
    .max(4_000_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Invalid image data."),
  lang: SupportedLanguageSchema.default("lt"),
});

const MealAnalysisSuccessSchema = NutritionMacrosSchema.extend({
  ok: z.literal(true),
  dishName: z.string().trim().min(1).max(200),
  calories: z.coerce.number().finite().positive().max(10_000),
  items: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  note: z.string().trim().min(1).max(1_000),
});

const MealAnalysisFailureSchema = z.object({
  ok: z.literal(false),
  detectedObject: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().min(1).max(500),
  aiErrorCode: z.enum(SAFE_AI_ERROR_CODES).optional(),
});

export const MealAnalysisSchema = z.discriminatedUnion("ok", [
  MealAnalysisSuccessSchema,
  MealAnalysisFailureSchema,
]);

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

function failedMealAnalysis(reason: string, aiErrorCode?: SafeAiErrorCode): MealAnalysis {
  return { ok: false, reason, ...(aiErrorCode ? { aiErrorCode } : {}) };
}

function unavailableMealAnalysis(
  error: unknown,
  lang: z.infer<typeof SupportedLanguageSchema>,
): MealAnalysis {
  return failedMealAnalysis(
    lang === "lt"
      ? "Nuotraukos analizė šiuo metu nepasiekiama. Bandykite dar kartą po akimirkos."
      : "Photo analysis is temporarily unavailable. Please try again in a moment.",
    getSafeAiErrorCode(error) ?? undefined,
  );
}

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const langName = LANGUAGE_NAMES[data.lang];

      const systemPrompt = `Tu esi pažangus maisto atpažinimo ir sporto dietologijos AI asistentas.
Nuodugniai išanalizuok pateiktą nuotrauką.

1. Jei nuotraukoje NĖRA maisto (tai daiktas, elektronika, kambarys, automobilis, drabužis, gyvūnas, žmogaus veidas ir pan.):
Nustatyk, kas tiksliai matoma nuotraukoje, ir grąžink TIKSLIAI šį JSON formatą:
{
  "ok": false,
  "detectedObject": "Konkretus matomas objektas ${langName} kalba (pvz. Kompiuterio klaviatūra, Automobilio salonas, Sportiniai bateliai)",
  "reason": "${data.lang === "lt" ? "Nuotraukoje matomas objektas nėra valgomas maistas. Nukreipkite kamerą į paruoštą patiekalą ar produktą." : "The detected object is not food. Please point your camera at a meal or food item."}"
}

2. Jei nuotraukoje YRA valgomas maistas ar gėrimas:
Apskaičiuok realistiškas maistines vertes (kalorijas, baltymus, angliavandenius, riebalus) pagal matomą porcijos dydį ir grąžink:
{
  "ok": true,
  "dishName": "Tikslus patiekalo pavadinimas ${langName} kalba",
  "calories": 450,
  "protein": 35,
  "carbs": 40,
  "fat": 15,
  "items": ["Ingredientas 1", "Ingredientas 2", "Ingredientas 3"],
  "note": "Trumpas maistinės vertės ir porcijos įvertis"
}

Niekada nepateik procentinio tikslumo ar confidence: tai yra nuotrauka pagrįstas įvertis, kurį vartotojas gali patikrinti prieš įrašydamas.

Atsakyk TIK TIKSLIU JSON be jokių markdown formatavimų.`;

      return await generateOrchestratedJson({
        task: "food-vision",
        supabase: context.supabase,
        userId: context.userId,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Išanalizuok šią maisto nuotrauką." },
              { type: "image", image: data.image },
            ],
          },
        ],
        schema: MealAnalysisSchema,
        maxOutputTokens: 1_200,
      });
    } catch (error: unknown) {
      console.error("Food vision handler error:", error);
      return unavailableMealAnalysis(error, data.lang);
    }
  });

const SaveInput = NutritionMacrosSchema.extend({
  dishName: z.string().trim().min(1).max(200),
  calories: z.coerce.number().finite().positive().max(10_000),
  note: z.string().trim().max(500).optional(),
  timeZone: IanaTimeZoneSchema,
}).strict();

export const savePhotoMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const today = dayInTimeZone(new Date(), data.timeZone);
    const meal = normalizeNutritionLogDraft({
      description: data.note || "Scanned with the AI Vision Scanner",
      food_name: data.dishName,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      note: data.note ?? "",
    });
    const { error } = await supabase
      .from("nutrition_logs")
      .insert({ user_id: userId, logged_on: today, ...meal });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
