import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

export const WARMUP_SLUGS = ["arm-circles", "bodyweight-squats", "band-pull-aparts", "plank"];

const SmartWarmupInput = z.object({
  targetMuscles: z.array(z.string()).min(1),
  equipment: z.array(z.string()).default(["bodyweight"]),
  durationMinutes: z.number().default(5),
  lang: z.string().default("lt"),
});

export const getSmartWarmup = createServerFn({ method: "POST" })
  .validator((data: unknown) => SmartWarmupInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    const prompt = `Tu esi sporto kineziterapeutas ir treneris platformoje GYMS.LIFE.
Sukurk greitą dinaminio apšilimo protokolą šioms raumenų grupėms: ${data.targetMuscles.join(", ")}.
Trukmė: ${data.durationMinutes} min.
Įranga: ${data.equipment.join(", ")}.

Atsakyk TIK TIKSLIU JSON formatu be markdown:
{
  "ok": true,
  "routineTitle": "Dinaminio apšilimo kompleksas ${langName} kalba",
  "totalDurationMinutes": ${data.durationMinutes},
  "steps": [
    {
      "name": "Pratimo pavadinimas",
      "durationOrReps": "60s arba 12 pakartojimų",
      "focus": "Tikslinis sąnarys ar raumuo",
      "instruction": "Trumpas atlikimo akcentas"
    }
  ]
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
        ok: true,
        routineTitle: data.lang === "lt" ? "Standartinis dinaminis apšilimas" : "Standard Warmup Routine",
        totalDurationMinutes: data.durationMinutes,
        steps: [
          { name: "Sąnarių mobilizacija", durationOrReps: "2 min", focus: "Bendras kūno aktyvavimas", instruction: "Ratai rankomis, klubų sukimai" },
          { name: "Kūno svorio pritūpimai", durationOrReps: "15 pakartojimų", focus: "Kojos ir šerdis", instruction: "Pilna judesio amplitudė" },
          { name: "Lenta (Plank)", durationOrReps: "45s", focus: "Šerdies aktyvavimas", instruction: "Įtemptas pilvo presas ir sėdmenys" },
        ],
      };
    }
  });

const SetAdviceInput = z.object({
  exerciseName: z.string(),
  currentSet: z.number(),
  targetReps: z.number(),
  actualReps: z.number(),
  rpe: z.number().min(1).max(10),
  lang: z.string().default("lt"),
});

export const getSetAdvice = createServerFn({ method: "POST" })
  .validator((data: unknown) => SetAdviceInput.parse(data))
  .handler(async ({ data }) => {
    const langName = data.lang === "lt" ? "lietuvių" : "anglų";
    
    const prompt = `Sportininkas atliko pratimą: "${data.exerciseName}".
Serija: #${data.currentSet}, Tikslas: ${data.targetReps} pakartojimai, Atliko: ${data.actualReps} pakartojimus, Subjektyvus nuovargis (RPE): ${data.rpe}/10.

Pateik momentinį, taiklų trenerio patarimą kitai serijai.
Atsakyk TIK TIKSLIU JSON:
{
  "ok": true,
  "weightAdjustment": "keep" | "increase" | "decrease",
  "suggestedAdjustmentKg": 0,
  "recommendedRestSec": 90,
  "advice": "Taiklus patarimas ${langName} kalba"
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
        ok: true,
        weightAdjustment: "keep",
        suggestedAdjustmentKg: 0,
        recommendedRestSec: 90,
        advice: data.lang === "lt" ? "Išlaikykite stabilią formą ir kontroliuokite judesį." : "Maintain form and control the tempo.",
      };
    }
  });

const DebriefInput = z.object({
  sessionDurationMin: z.number(),
  totalSetsCompleted: z.number(),
  avgRpe: z.number(),
  exercisesCompleted: z.array(z.string()),
  lang: z.string().default("lt"),
});

export const getSessionDebrief = createServerFn({ method: "POST" })
  .validator((data: unknown) => DebriefInput.parse(data))
  .handler(async ({ data }) => {
    const prompt = `Išanalizuok baigtos treniruotės duomenis:
Trukmė: ${data.sessionDurationMin} min, Viso serijų: ${data.totalSetsCompleted}, Vidutinis RPE: ${data.avgRpe}, Pratimai: ${data.exercisesCompleted.join(", ")}.

Atsakyk TIK JSON:
{
  "ok": true,
  "recoveryHours": 48,
  "stimulusScore": 92,
  "summary": "Treniruotės apibendrinimas",
  "nutritionTip": "Mitybos rekomendacija po treniruotės"
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
        ok: true,
        recoveryHours: 48,
        stimulusScore: 85,
        summary: data.lang === "lt" ? "Puikiai atlikta treniruotė." : "Great workout session.",
        nutritionTip: data.lang === "lt" ? "30-40g baltymų ir angliavandeniai atsistatymui." : "30-40g protein with carbs.",
      };
    }
  });
