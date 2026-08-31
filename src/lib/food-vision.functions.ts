import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
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
Pirmiausia GRIEŽTAI įvertink, ar nuotraukoje matomas valgomas maistas ar patiekalas.
Jeigu nuotraukoje yra daiktas, gyvūnas, drabužis, elektronika ar bet koks NEMAISTINIS objektas:
grąžink TIKSLIAI tokį JSON:
{
  "ok": false,
  "reason": "${data.lang === "lt" ? "Nuotraukoje maistas neatpažintas. Prašome nukreipti kamerą į paruoštą patiekalą ar maisto produktą." : "No food detected. Please scan a prepared dish or food item."}"
}

Jei nuotraukoje YRA maistas, apskaičiuok tikslias maistines vertes ir grąžink:
{
  "ok": true,
  "dishName": "Tikslus patiekalo pavadinimas ${langName} kalba",
  "calories": 480,
  "protein": 36,
  "carbs": 42,
  "fat": 14,
  "items": ["Ingredientas 1", "Ingredientas 2", "Ingredientas 3"],
  "confidence": 94,
  "note": "Komentaras apie baltymų ir skaidulų balansą"
}`;

      // Naudojame oficialų Google Gemini v1beta endpointą
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

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Fallback į gemini-2.0-flash jei 2.5 endpointas grąžina klaidą
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const fallbackRes = await fetch(fallbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!fallbackRes.ok) {
          const errText = await fallbackRes.text();
          console.error("Gemini Vision klaida:", errText);
          return { ok: false, reason: data.lang === "lt" ? "Nepavyko apdoroti vaizdo. Bandykite dar kartą." : "Image processing failed." };
        }

        const dataRes = await fallbackRes.json();
        const text = dataRes.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return { ok: false, reason: "Negautas atsakymas." };
        return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas iš modelio." };

      return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
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
  .validator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data }) => {
    const { user, supabase } = await requireSupabaseAuth();
    if (!user) throw new Error("UNAUTHORIZED");

    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("nutrition_logs").insert({
      user_id: user.id,
      logged_on: today,
      meal_type: "lunch",
      name: data.dishName,
      calories: data.calories,
      protein_g: data.protein,
      carbs_g: data.carbs,
      fat_g: data.fat,
      notes: data.note ?? "Nuskaityta su AI Vision Scanner",
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RecommendMenuInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

export const recommendMenu = createServerFn({ method: "POST" })
  .validator((data: unknown) => RecommendMenuInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { ok: false, reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas." : "AI engine not configured." };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

      const prompt = `Analizuok šį restoranų meniu. Išrink geriausius patiekalus sportininkui.
Atsakyk TIK JSON formatu:
{
  "ok": true,
  "recommendations": [
    {
      "dishName": "Patiekalo pavadinimas",
      "calories": 520,
      "protein": 40,
      "carbs": 45,
      "fat": 12,
      "reason": "Geras baltymų ir angliavandenių balansas"
    }
  ]
}`;

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

      if (!response.ok) {
        return { ok: false, reason: "Meniu apdorojimo klaida." };
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas." };

      return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });
