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
        reason: data.lang === "lt" ? "GEMINI_API_KEY nerastas serveryje." : "GEMINI_API_KEY not configured.",
      };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const langName = data.lang === "lt" ? "lietuvių" : "anglų";

      const prompt = `Tu esi profesionalus sporto dietologas ir AI maisto skeneris.
Išanalizuok šią patiekalo nuotrauką.
Atsakyk TIKTAI griežtu JSON formatu (be jokių markdown blokų):
{
  "ok": true,
  "dishName": "Patiekalo pavadinimas ${langName} kalba",
  "calories": 450,
  "protein": 35,
  "carbs": 40,
  "fat": 15,
  "items": ["Ingredientas 1", "Ingredientas 2"],
  "confidence": 92,
  "note": "Trumpas dietologo komentaras"
}
Jei nuotraukoje NĖRA maisto, grąžink: {"ok": false, "reason": "Nuotraukoje maistas neatpažintas."}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        return { ok: false, reason: "Gemini klaida: " + response.statusText };
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas iš modelio." };

      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (err: any) {
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
      notes: data.note ?? "Nuskaityta su Food Vision AI",
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
      return { ok: false, reason: data.lang === "lt" ? "GEMINI_API_KEY nerastas serveryje." : "GEMINI_API_KEY not configured." };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

      const prompt = `Tu esi profesionalus sporto dietologas. Analizuok restorano meniu nuotrauką ir pateik geriausius pasirinkimus sportininkui.
Atsakyk TIKTAI griežtu JSON formatu (be markdown):
{
  "ok": true,
  "recommendations": [
    {
      "dishName": "Patiekalo pavadinimas",
      "calories": 550,
      "protein": 42,
      "carbs": 45,
      "fat": 14,
      "reason": "Aukštas baltymų kiekis, subalansuoti angliavandeniai"
    }
  ]
}
Jei meniu neįskaitomas: {"ok": false, "reason": "Meniu nuotrauka neįskaitoma."}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        return { ok: false, reason: "Gemini klaida: " + response.statusText };
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas iš modelio." };

      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (err: any) {
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });
