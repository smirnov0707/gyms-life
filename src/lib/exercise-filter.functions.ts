import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";
import { parseAiJson } from "./ai-json.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FilterInput = z.object({
  prompt: z.string().min(2).max(300),
  lang: z.string().default("lt"),
});

export const ExerciseFilterSuggestionSchema = z.object({
  group: z.enum([
    "all",
    "legs",
    "chest",
    "back",
    "shoulders",
    "arms",
    "abs",
    "core",
    "glutes",
    "cardio",
    "fullbody",
    "mobility",
  ]),
  level: z.enum(["all", "beginner", "intermediate", "advanced"]),
  equipment: z.enum([
    "all",
    "bodyweight",
    "barbell",
    "dumbbell",
    "kettlebell",
    "band",
    "machine",
    "cable",
    "pullup_bar",
    "trx",
    "ball",
    "cardio",
    "other",
  ]),
  safety: z.enum(["all", "knee_safe", "back_safe", "shoulder_safe"]),
  query: z.string().trim().max(300),
});

export type ExerciseFilterSuggestion = z.infer<typeof ExerciseFilterSuggestionSchema>;

export const smartExerciseFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => FilterInput.parse(data))
  .handler(async ({ data, context }) => {
    const prompt = `Vartotojas ieško pratimų fitneso bibliotekoje pagal šią užklausą: "${data.prompt}".

Parink tinkamus filtravimo kriterijus:
- group: "all" | "legs" | "chest" | "back" | "shoulders" | "arms" | "abs" | "core" | "glutes" | "cardio" | "fullbody" | "mobility"
- level: "all" | "beginner" | "intermediate" | "advanced"
- equipment: "all" | "bodyweight" | "barbell" | "dumbbell" | "kettlebell" | "band" | "machine" | "cable" | "pullup_bar" | "trx" | "ball" | "cardio" | "other"
- safety: "all" | "knee_safe" | "back_safe" | "shoulder_safe"
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
        userId: context.userId,
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.1,
      });

      return parseAiJson(raw, ExerciseFilterSuggestionSchema);
    } catch {
      return {
        group: "all",
        level: "all",
        equipment: "all",
        safety: "all",
        query: data.prompt,
      };
    }
  });
