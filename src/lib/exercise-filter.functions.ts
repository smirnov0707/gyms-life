import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

const FilterInput = z.object({
  prompt: z.string().min(2).max(300),
  lang: z.string().default("lt"),
});

export const smartExerciseFilter = createServerFn({ method: "POST" })
  .validator((data: unknown) => FilterInput.parse(data))
  .handler(async ({ data }) => {
    const prompt = `Vartotojas ieško pratimų fitneso bibliotekoje pagal šią užklausą: "${data.prompt}".

Parink tinkamus filtravimo kriterijus:
- group: "all" | "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body"
- level: "all" | "beginner" | "intermediate" | "advanced"
- equipment: "all" | "barbell" | "dumbbell" | "cable" | "bodyweight" | "band" | "machine"
- safety: "all" | "low_back_friendly" | "knee_friendly" | "shoulder_friendly"
- query: "raktinis žodis paieškai (jei yra specifinis pratimas)"

Atsakyk TIK TIKSLIU JSON:
{
  "group": "chest",
  "level": "all",
  "equipment": "dumbbell",
  "safety": "all",
  "query": ""
}`;

    try {
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.1,
      });

      return JSON.parse(
        raw
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch (err: any) {
      return {
        group: "all",
        level: "all",
        equipment: "all",
        safety: "all",
        query: data.prompt,
      };
    }
  });
