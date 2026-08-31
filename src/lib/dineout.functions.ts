import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RestaurantSearchInput = z.object({
  query: z.string().min(1),
  goal: z.string().default("muscle_gain"),
  lang: z.string().default("lt"),
});

export const searchRestaurantDishes = createServerFn({ method: "POST" })
  .validator((data: unknown) => RestaurantSearchInput.parse(data))
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return {
        ok: false,
        reason: data.lang === "lt" ? "AI variklis nesukonfigūruotas serveryje." : "AI engine not configured.",
      };
    }

    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const goalText = data.goal === "fat_loss" 
      ? "svorio metimui / ryškinimui (mažiau kalorijų, daug baltymų)" 
      : data.goal === "muscle_gain"
      ? "raumenų auginimui (daug baltymų, subalansuoti angliavandeniai)"
      : "sveikai subalansuotai mitybai";

    const prompt = `Tu esi profesionalus sporto dietologas ir restoranų meniu ekspertas.
Vartotojas įvedė restorano ar kavinės pavadinimą: "${data.query}".

UŽDUOTIS:
1. Pirmiausia atpažink ir ištaisyk neteisingai parašytą ar sutrumpintą restorano pavadinimą (pvz. "mcdonals" -> "McDonald's", "hesburer" -> "Hesburger", "subvay" -> "Subway", "cili pica" -> "Čili Pizza", "kfc" -> "KFC", "sushi express" -> "Sushi Express", "vici" -> "Vičiūnų restoranas/kavinė", "dodo" -> "Dodo Pizza").
2. Jei tai žinomas restoranas, kavinė ar net bendras maisto tipas (pvz. "kebabinė", "suši baras", "picerija"), parink 4-5 geriausius, realius patiekalus iš to tinklo/tipo meniu, kurie idealiai tinka ${goalText}.
3. Jei tai visai nesuprantamas žodis, sugeneruok universalius sveikus patiekalus pagal panašią virtuvę.

Atsakyk TIK TIKSLIU JSON formatu be jokių markdown blokų:
{
  "ok": true,
  "canonicalRestaurantName": "Oficialus ir taisyklingas restorano pavadinimas",
  "category": "Greitas maistas / Restoranas / Kavinė",
  "dishes": [
    {
      "name": "Taisyklingas patiekalo pavadinimas",
      "calories": 480,
      "protein": 38,
      "carbs": 42,
      "fat": 14,
      "recommendationReason": "Kodėl šis patiekalas idealus (pvz. Dviguba vištienos krūtinėlė, be majonezo padažo)",
      "fitScore": 95
    }
  ],
  "coachTip": "Trenerio patarimas, kaip modifikuoti užsakymą (pvz. Prašykite padažo atskirai, pakeiskite bulvytes į salotas)"
}`;

    // 1 Bandymas: Groq Llama 3.3 (Momentinis atsakas)
    if (groqKey) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) {
            return JSON.parse(content);
          }
        }
      } catch (err) {
        console.warn("Groq failover to Gemini:", err);
      }
    }

    // 2 Bandymas (Fallback): Google Gemini 2.5 Flash
    if (geminiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const geminiRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        });

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
          }
        }
      } catch (err: any) {
        console.error("Gemini restaurant error:", err);
      }
    }

    return {
      ok: false,
      reason: data.lang === "lt" ? "Nepavyko gauti meniu. Bandykite dar kartą." : "Failed to fetch menu.",
    };
  });
