import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

const BuildWorkoutInput = z.object({
  request: z.string().min(3),
  lang: z.string().default("lt"),
  minutes: z.number().min(10).max(150).default(45),
});

export type RequestedWorkoutBlock = {
  slug: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  muscle?: string;
  note?: string;
  hasPage: boolean;
};

export type RequestedWorkout = {
  ok: boolean;
  title: string;
  summary: string;
  total_minutes: number;
  warmup: string[];
  blocks: RequestedWorkoutBlock[];
  cooldown: string[];
  tips: string[];
};

const RequestedWorkoutSchema = z.object({
  ok: z.boolean().default(true),
  title: z.string(),
  summary: z.string().default(""),
  total_minutes: z.number(),
  warmup: z.array(z.string()).default([]),
  blocks: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      sets: z.number(),
      reps: z.string(),
      rest_seconds: z.number(),
      muscle: z.string().optional(),
      note: z.string().optional(),
      hasPage: z.boolean().default(false),
    }),
  ),
  cooldown: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
});

export const buildRequestedWorkout = createServerFn({ method: "POST" })
  .validator((data: unknown) => BuildWorkoutInput.parse(data))
  .handler(async ({ data }): Promise<RequestedWorkout> => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const prompt = `Tu esi profesionalus biomechanikos ir jėgos fitneso treneris platformoje GYMS.LIFE.
Sukurk optimalią treniruotę pagal vartotojo užklausą.

Užklausa: ${data.request}
Trukmė: ${data.minutes} min
Kalba: ${langName}

Atsakyk TIK JSON pagal šią struktūrą:
{
  "ok": true,
  "title": "Treniruotės pavadinimas",
  "summary": "Trumpa trenerio santrauka",
  "total_minutes": ${data.minutes},
  "warmup": ["Apšilimo pratimas"],
  "blocks": [
    {
      "slug": "exercise-slug",
      "name": "Pratimo pavadinimas",
      "sets": 3,
      "reps": "8-10",
      "rest_seconds": 90,
      "muscle": "Pagrindinis raumuo",
      "note": "Technikos akcentas",
      "hasPage": false
    }
  ],
  "cooldown": ["Tempimo pratimas"],
  "tips": ["Svarbiausias patarimas"]
}`;

    try {
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk tik griežtu JSON formatu pagal pateiktą struktūrą." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });
      return RequestedWorkoutSchema.parse(JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()));
    } catch {
      return {
        ok: false,
        title: data.lang === "lt" ? "Treniruotė" : "Workout",
        summary: data.lang === "lt" ? "Nepavyko sugeneruoti treniruotės." : "Failed to build workout.",
        total_minutes: data.minutes,
        warmup: [],
        blocks: [],
        cooldown: [],
        tips: [],
      };
    }
  });
