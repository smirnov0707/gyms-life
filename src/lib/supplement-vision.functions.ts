import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SupplementVisionInput = z.object({
  image: z.string().min(10),
  lang: z.string().default("lt"),
});

export const analyzeSupplementPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => SupplementVisionInput.parse(data))
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

      const prompt = `Tu esi profesionalus sporto papildų ir farmakologijos AI ekspertas.
Išanalizuok pateiktą maisto papildo pakuotės ar sudėties etiketės nuotrauką.

Jei nuotraukoje NĖRA papildo ar etiketė neįskaitoma:
{"ok": false, "reason": "Papildo etiketė neįskaitoma. Nufotografuokite sudėties lentelę iš arčiau."}

Jei papildas atpažintas:
{
  "ok": true,
  "productName": "Papildo pavadinimas ir gamintojas",
  "category": "Kreatinas / Baltymai / Vitaminai / Pre-workout / Kita",
  "activeIngredients": [
    {"name": "Veiklioji medžiaga", "amount": "5g", "purpose": "Kam skirta"}
  ],
  "dosageRecommendation": "Optimali vartojimo dozė sportininkui ${langName} kalba",
  "timing": "Prieš treniruotę / Ryte / Po treniruotės",
  "warnings": "Įspėjimai dėl šalutinio poveikio ar sąveikos",
  "verdictScore": 92
}
Atsakyk TIK TIKSLIU JSON be jokio markdown.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
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

      let res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        res = await fetch(fallbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        return { ok: false, reason: data.lang === "lt" ? "Nepavyko nuskaityti papildo." : "Scan failed." };
      }

      const result = await res.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas." };

      return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });
