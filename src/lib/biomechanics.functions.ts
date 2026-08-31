import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BiomechanicsInput = z.object({
  image: z.string().min(10),
  exerciseName: z.string().default("squat"),
  lang: z.string().default("lt"),
});

export const analyzeExerciseForm = createServerFn({ method: "POST" })
  .validator((data: unknown) => BiomechanicsInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { ok: false, reason: "AI regos variklis nesukonfigūruotas." };
    }

    try {
      const base64Data = data.image.includes(",") ? data.image.split(",")[1] : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const langName = data.lang === "lt" ? "lietuvių" : "anglų";

      const prompt = `Tu esi profesionalus sporto biomechanikos kineziterapeutas ir treneris.
Išanalizuok šį pratimo atlikimo kadrą (${data.exerciseName}).

Įvertink:
1. Stuburo padėtį ir neutralumą.
2. Sąnarių kampus (klubai, keliai, pečiai).
3. Svorio / štangos trajektoriją ir stabilumą.

Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "exerciseDetected": "Pratimo pavadinimas",
  "score": 90,
  "jointAngles": {
    "kneeFlexion": "110° (Optimalus)",
    "torsoAngle": "45° (Geras neutralumas)"
  },
  "strengths": ["Geras gylis", "Stabili pėdų pozicija"],
  "corrections": ["Kelius stumti labiau į išorę ekscentrinėje fazėje"],
  "injuryRisk": "low",
  "coachCue": "Taiklus biomechaninis patarimas ${langName} kalba"
}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } },
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
        const fallback = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        res = await fetch(fallback, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) return { ok: false, reason: "Nepavyko atlikti formos analizės." };

      const result = await res.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false, reason: "Negautas atsakymas." };

      return JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return { ok: false, reason: err.message || "Biomechanikos klaida." };
    }
  });
