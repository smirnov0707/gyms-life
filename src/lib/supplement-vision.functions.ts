import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SupplementVisionInput = z.object({ image: z.string().min(10), lang: z.string().default("lt") });
const ProductSchema = z.object({
  name: z.string(), dose: z.string(), category: z.string(), timesPerDay: z.number().default(1), withFood: z.boolean().default(false), preferredTime: z.string().default("any"), notes: z.string().default(""), confidence: z.number().default(0), readable: z.string().default(""),
});
const AiProductSchema = z.object({ productName: z.string(), category: z.string(), dosageRecommendation: z.string(), timing: z.string(), warnings: z.string().default(""), verdictScore: z.number().default(0) });

export const analyzeSupplementPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => SupplementVisionInput.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return { ok: false as const, reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas serveryje." : "AI engine not configured." };
    try {
      const base64Data = data.image.includes(",") ? (data.image.split(",")[1] ?? "") : data.image;
      const mimeType = data.image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const langName = data.lang === "lt" ? "lietuvių" : "anglų";
      const prompt = `Tu esi profesionalus sporto papildų AI ekspertas. Išanalizuok etiketės nuotrauką. Jei papildas atpažintas grąžink JSON: {"productName":"pavadinimas","category":"kategorija","dosageRecommendation":"dozė ${langName} kalba","timing":"laikas","warnings":"įspėjimai","verdictScore":92}. Jei neįskaitoma grąžink {"ok":false,"reason":"Papildo etiketė neįskaitoma."}. Atsakyk tik JSON.`;
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } };
      let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) return { ok: false as const, reason: data.lang === "lt" ? "Nepavyko nuskaityti papildo." : "Scan failed." };
      const result = await res.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return { ok: false as const, reason: "Negautas atsakymas." };
      const parsed = JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim()) as unknown;
      const ai = AiProductSchema.safeParse(parsed);
      if (!ai.success) return { ok: false as const, reason: "Papildo etiketė neįskaitoma." };
      const p = ai.data;
      return {
        ok: true as const,
        products: [ProductSchema.parse({ name: p.productName, dose: p.dosageRecommendation, category: p.category, timesPerDay: 1, withFood: false, preferredTime: p.timing, notes: p.warnings, confidence: p.verdictScore, readable: p.productName })],
      };
    } catch (err: any) {
      return { ok: false as const, reason: err.message || "Apdorojimo klaida." };
    }
  });
