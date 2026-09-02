import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createAiRouterProvider } from "./ai-gateway.server";
import { generateJson } from "./ai-json.server";

const AnalyzeInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

const MealAnalysisSuccessSchema = z.object({
  ok: z.literal(true),
  dishName: z.string().trim().min(1).max(200),
  calories: z.coerce.number().finite().min(0).max(10_000),
  protein: z.coerce.number().finite().min(0).max(1_000),
  carbs: z.coerce.number().finite().min(0).max(1_000),
  fat: z.coerce.number().finite().min(0).max(1_000),
  items: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  confidence: z.coerce.number().finite().min(0).max(100),
  note: z.string().trim().min(1).max(1_000),
});

const MealAnalysisFailureSchema = z.object({
  ok: z.literal(false),
  detectedObject: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().min(1).max(500),
});

export const MealAnalysisSchema = z.discriminatedUnion("ok", [
  MealAnalysisSuccessSchema,
  MealAnalysisFailureSchema,
]);

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

function failedMealAnalysis(reason: string): MealAnalysis {
  return { ok: false, reason };
}

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      return failedMealAnalysis(
        data.lang === "lt"
          ? "AI variklis nesukonfigūruotas serveryje."
          : "AI engine not configured.",
      );
    }

    try {
      const langName = data.lang === "lt" ? "lietuvių" : "anglų";

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
  "confidence": 94,
  "note": "Komentaras apie patiekalo maistinę vertę ir porciją"
}

Atsakyk TIK TIKSLIU JSON be jokių markdown formatavimų.`;

      const provider = createAiRouterProvider("food-vision.functions");
      return await generateJson(provider("google/gemini-2.5-flash"), {
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
      return failedMealAnalysis(
        data.lang === "lt" ? "Apdorojimo klaida." : "Failed to process the image.",
      );
    }
  });

const SaveInput = z.object({
  dishName: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  note: z.string().optional(),
});

export const savePhotoMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("nutrition_logs").insert({
      user_id: userId,
      logged_on: today,
      food_name: data.dishName,
      description: data.note ?? "Scanned with the AI Vision Scanner",
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      note: data.note ?? "Nuskaityta su AI Vision Scanner",
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
