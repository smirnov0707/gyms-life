import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      return {
        ok: false,
        reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas serveryje." : "AI engine not configured.",
      };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
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

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      let response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Atsarginis modelio kreipinys
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        response = await fetch(fallbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini Vision error:", errText);
        return {
          ok: false,
          reason: data.lang === "lt" ? "Nepavyko atlikti analizės. Pabandykite dar kartą." : "Analysis failed. Please try again.",
        };
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas iš modelio." };

      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (err: any) {
      console.error("Food vision handler error:", err);
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
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

const RecommendMenuInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

export const recommendMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => RecommendMenuInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!geminiKey) {
      return { ok: false, reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas." : "AI engine not configured." };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

      const prompt = `Analizuok šį restoranų meniu. Išrink geriausius patiekalus sportininkui. Atsakyk TIK JSON formatu.`;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) return { ok: false, reason: "Meniu apdorojimo klaida." };
      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas." };

      return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });
