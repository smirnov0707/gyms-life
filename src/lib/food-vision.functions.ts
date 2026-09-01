import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({ image: z.string().min(10), lang: z.string().default("lt") });
const RecommendMenuInput = z.object({ image: z.string().min(10), lang: z.string().default("lt") });

async function callGemini(image: string, prompt: string) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  const base64Data = image.includes(",") ? (image.split(",")[1] ?? "") : image;
  const mimeType = image.startsWith("data:image/png") ? "image/png" : "image/jpeg";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
  const payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } };
  let response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  }
  if (!response.ok) return null;
  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  return rawText ? JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim()) : null;
}

export const analyzeMealPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }) => {
    if (!process.env.GEMINI_API_KEY) return { ok: false, reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas serveryje." : "AI engine not configured." };
    try {
      const langName = data.lang === "lt" ? "lietuvių" : "anglų";
      const result = await callGemini(data.image, `Tu esi pažangus maisto atpažinimo ir sporto dietologijos AI asistentas. Išanalizuok nuotrauką. Jei joje nėra maisto, grąžink {"ok":false,"detectedObject":"objektas ${langName} kalba","reason":"objektas nėra maistas"}. Jei yra maisto, grąžink {"ok":true,"dishName":"patiekalo pavadinimas ${langName} kalba","calories":450,"protein":35,"carbs":40,"fat":15,"items":["ingredientas"],"confidence":94,"note":"trumpas komentaras"}. Atsakyk tik JSON.`);
      return result ?? { ok: false, reason: data.lang === "lt" ? "Nepavyko atlikti analizės." : "Analysis failed." };
    } catch (err: any) {
      console.error("Food vision handler error:", err);
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });

const SaveInput = z.object({ dishName: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), note: z.string().optional() });
export const savePhotoMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("nutrition_logs").insert({ user_id: context.userId, logged_on: new Date().toISOString().slice(0, 10), food_name: data.dishName, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat, note: data.note ?? "Nuskaityta su AI Vision Scanner" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recommendMenu = createServerFn({ method: "POST" })
  .validator((data: unknown) => RecommendMenuInput.parse(data))
  .handler(async ({ data }) => {
    if (!process.env.GEMINI_API_KEY) return { ok: false, reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas." : "AI engine not configured." };
    try {
      const result = await callGemini(data.image, "Analizuok šį restoranų meniu. Išrink geriausius patiekalus sportininkui. Atsakyk tik JSON formatu.");
      return result ?? { ok: false, reason: "Meniu apdorojimo klaida." };
    } catch (err: any) {
      return { ok: false, reason: err.message || "Apdorojimo klaida." };
    }
  });
