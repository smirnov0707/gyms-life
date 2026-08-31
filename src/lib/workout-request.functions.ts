import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

const BuildWorkoutInput = z.object({
  muscleGroups: z.array(z.string()).min(1),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  durationMinutes: z.number().default(45),
  equipment: z.array(z.string()).default(["gym_full"]),
  injuries: z.string().optional(),
  lang: z.string().default("lt"),
});

export const buildRequestedWorkout = createServerFn({ method: "POST" })
  .validator((data: unknown) => BuildWorkoutInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    
    const prompt = `Tu esi profesionalus biomechanikos ir jėgos fitneso treneris platformoje GYMS.LIFE.
Sukurk optimalią, moksliškai pagrįstą treniruočių programą šiai sesijai:

- Tikslinės raumenų grupės: ${data.muscleGroups.join(", ")}
- Patirties lygis: ${data.experienceLevel}
- Trukmė: ${data.durationMinutes} min
- Prieinama įranga: ${data.equipment.join(", ")}
- Traumos / apribojimai: ${data.injuries || "nėra"}

Atsakyk TIK TIKSLIU JSON formatu be jokio markdown:
{
  "ok": true,
  "title": "Treniruotės pavadinimas ${langName} kalba",
  "estimatedMinutes": ${data.durationMinutes},
  "warmup": [
    { "exercise": "Apšilimo pratimas", "duration": "2 min", "focus": "Kam skirta" }
  ],
  "exercises": [
    {
      "name": "Pratimo pavadinimas",
      "targetMuscle": "Pagrindinis raumuo",
      "sets": 4,
      "reps": "8-10",
      "restSeconds": 90,
      "cue": "Svarbiausias atlikimo technikos akcentas (cue)"
    }
  ],
  "cooldown": [
    { "stretch": "Tempimo pratimas", "duration": "60s" }
  ],
  "coachSummary": "Trumpa trenerio įžvalga šiai sesijai"
}`;

    try {
      const raw = await askFastTextAi({
        messages: [
          { role: "system", content: "Atsakyk TIK griežtu JSON formatu." },
          { role: "user", content: prompt },
        ],
        jsonMode: true,
        temperature: 0.2,
      });

      return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err: any) {
      return {
        ok: false,
        reason: data.lang === "lt" ? "Nepavyko sugeneruoti treniruotės." : "Failed to build workout.",
      };
    }
  });
