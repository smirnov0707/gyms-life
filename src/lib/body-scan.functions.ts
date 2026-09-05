import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LANGUAGE_NAMES, SupportedLanguageSchema } from "./language.schema";
import { dayInTimeZone } from "./local-day";
import { loadPersistedProfileTimeZone } from "./user-context.server";

/**
 * Today in the athlete's stored timezone, falling back to UTC.
 *
 * A missing or unreadable timezone must not cost the measurement itself, so
 * this never throws: an approximate date is worth more than a lost scan.
 */
async function athleteDay(
  supabase: Parameters<typeof loadPersistedProfileTimeZone>[0],
  userId: string,
): Promise<string> {
  try {
    return dayInTimeZone(new Date(), await loadPersistedProfileTimeZone(supabase, userId));
  } catch {
    return dayInTimeZone(new Date(), "UTC");
  }
}

const BodyScanInput = z.object({
  images: z.array(z.string().startsWith("data:image/")).min(1).max(3),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300).optional(),
  age: z.number().min(10).max(100).optional(),
  sex: z.enum(["male", "female", "unknown"]).default("unknown"),
  lang: SupportedLanguageSchema.default("lt"),
});

const num = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      if (n == null || !Number.isFinite(n)) return undefined;
      return Math.min(max, Math.max(min, n));
    });

const ScanSchema = z.object({
  isHuman: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true"),
  fullBodyVisible: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true"),
  rejectReason: z.string().optional().default(""),
  confidence: num(0, 100),
  bodyFat: num(2, 70),
  waistCm: num(40, 200),
  neckCm: num(20, 70),
  chestCm: num(50, 200),
  hipsCm: num(50, 200),
  armCm: num(15, 70),
  thighCm: num(25, 100),
  estimatedWeightKg: num(30, 300),
  summary: z.string().optional().default(""),
});

const round1 = (n: number) => Math.round(n * 10) / 10;

/** US Navy circumference method — the clinical standard for tape-based body fat. */
function navyBodyFat(
  sex: "male" | "female" | "unknown",
  heightCm: number,
  waistCm?: number,
  neckCm?: number,
  hipsCm?: number,
): number | null {
  if (!waistCm || !neckCm) return null;
  const log10 = Math.log10;
  if (sex === "female") {
    if (!hipsCm) return null;
    const inner = waistCm + hipsCm - neckCm;
    if (inner <= 0) return null;
    const bf = 495 / (1.29579 - 0.35004 * log10(inner) + 0.221 * log10(heightCm)) - 450;
    return Number.isFinite(bf) ? bf : null;
  }
  const inner = waistCm - neckCm;
  if (inner <= 0) return null;
  const bf = 495 / (1.0324 - 0.19077 * log10(inner) + 0.15456 * log10(heightCm)) - 450;
  return Number.isFinite(bf) ? bf : null;
}

/** Deurenberg BMI equation — independent cross-check when weight is known. */
function bmiBodyFat(
  sex: "male" | "female" | "unknown",
  heightCm: number,
  weightKg?: number,
  age = 30,
): number | null {
  if (!weightKg) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const sexFactor = sex === "female" ? 0 : sex === "male" ? 1 : 0.5;
  const bf = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return Number.isFinite(bf) ? bf : null;
}

export const analyzeBodyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => BodyScanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { generateOrchestratedJson } = await import("./ai-orchestrator.server");

    const language = LANGUAGE_NAMES[data.lang];

    const system = `You are an anthropometric vision analyst measuring a human body from photographs.

STEP 1 — GATEKEEPING (strict, zero tolerance). Only a photo of a real, living human body may be analysed.
Set isHuman=false when ANY supplied image shows: no person, only a face/head, an animal, a pet, food, a wall/floor/fabric/texture, furniture, a device or any other object, a drawing/illustration/AI render, a screenshot, a mannequin, a statue, or a photo of a screen or printed picture.
Default to isHuman=false whenever you are not certain a real person is present — never guess.
Set fullBodyVisible=false when the torso and legs are not fully in frame, the person is cropped, too far/too dark/blurred, or bulky clothing completely hides body shape.
All images must show the same real person; if they do not, set isHuman=false.
If either is false: fill rejectReason with one short sentence in ${language} explaining exactly what to fix, omit all measurement fields, set confidence 0.

STEP 2 — MEASUREMENT (only when the gate passes).
Scale reference: stated standing height = ${data.heightCm} cm. Measure pixel proportions against this scale.
Sex: ${data.sex}. Age: ${data.age ?? "unknown"}.${
      data.weightKg
        ? ` Known body weight: ${data.weightKg} kg — every estimate must stay consistent with this mass.`
        : ""
    }
Report TAPE circumferences in centimetres, one decimal, at the standard landmarks:
- waistCm: narrowest point between ribs and navel (men: at the navel).
- neckCm: just below the larynx — REQUIRED, it drives the clinical body-fat formula.
- hipsCm: widest point of the buttocks — REQUIRED for females.
- chestCm: at nipple line, relaxed. armCm: mid-biceps relaxed. thighCm: upper thigh below the gluteal fold.
Sanity rules: for adults neck is typically 30-45 cm, waist 60-130 cm, and waist > neck always. Never output a placeholder or a rounded guess like 100.0 for everything.
Also give bodyFat (visual estimate, %) and estimatedWeightKg.
confidence = 0-100 honest reliability given photo count, pose, clothing and lighting.
summary = 1-2 short sentences in ${language} about composition and what to focus on.`;

    let result: z.infer<typeof ScanSchema>;
    try {
      result = await generateOrchestratedJson({
        task: "body-scan",
        supabase,
        userId,
        system,
        schema: ScanSchema,
        maxOutputTokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Photos of the same person (${data.images.length}): ${
                  data.images.length > 1 ? "front and side/back views" : "single view"
                }. Verify it is a real human body, then measure it.`,
              },
              ...data.images.map((image) => ({ type: "image" as const, image })),
            ],
          },
        ],
      });
    } catch {
      return {
        ok: false as const,
        reason:
          data.lang === "lt"
            ? "AI analizė nepavyko. Pabandyk dar kartą su šviesesne, ryškesne nuotrauka."
            : "AI analysis failed. Try again with a brighter, sharper photo.",
      };
    }

    if (!result.isHuman || !result.fullBodyVisible) {
      return {
        ok: false as const,
        reason:
          result.rejectReason ||
          (data.lang === "lt"
            ? "Nuotraukoje nematyti viso žmogaus kūno. Nufotografuok visą figūrą iš priekio."
            : "No full human body detected. Take a photo of your whole body from the front."),
      };
    }

    // ---- Reconcile the visual estimate with deterministic clinical formulas ----
    const navy = navyBodyFat(data.sex, data.heightCm, result.waistCm, result.neckCm, result.hipsCm);
    const bmi = bmiBodyFat(data.sex, data.heightCm, data.weightKg, data.age);
    const visual = result.bodyFat ?? null;

    const parts: Array<{ value: number; weight: number }> = [];
    if (navy != null && navy > 2 && navy < 65) parts.push({ value: navy, weight: 0.5 });
    if (bmi != null && bmi > 2 && bmi < 65) parts.push({ value: bmi, weight: 0.2 });
    if (visual != null) parts.push({ value: visual, weight: 0.3 });

    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const bodyFat = totalWeight
      ? round1(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight)
      : null;

    // agreement between independent methods = objective accuracy signal
    const values = parts.map((p) => p.value);
    const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : null;
    const aiConfidence = result.confidence ?? 60;
    const confidence = Math.max(
      20,
      Math.min(
        99,
        Math.round(
          spread == null
            ? aiConfidence * 0.8
            : aiConfidence * 0.6 + Math.max(0, 100 - spread * 8) * 0.4,
        ),
      ),
    );

    const weightKg = data.weightKg ?? result.estimatedWeightKg ?? null;
    const leanMassKg = weightKg && bodyFat != null ? round1(weightKg * (1 - bodyFat / 100)) : null;
    const fatMassKg = weightKg && bodyFat != null ? round1((weightKg * bodyFat) / 100) : null;
    const bmiValue = weightKg ? round1(weightKg / (data.heightCm / 100) ** 2) : null;
    const whtr = result.waistCm ? round1(result.waistCm / data.heightCm) : null;
    const whr = result.waistCm && result.hipsCm ? round1(result.waistCm / result.hipsCm) : null;

    const measured = {
      body_fat: bodyFat,
      waist_cm: result.waistCm ?? null,
      neck_cm: result.neckCm ?? null,
      chest_cm: result.chestCm ?? null,
      hips_cm: result.hipsCm ?? null,
      arm_cm: result.armCm ?? null,
      thigh_cm: result.thighCm ?? null,
      weight_kg: weightKg,
    };

    // The athlete's own calendar day. A UTC date puts a 01:00 scan in
    // Vilnius on the previous day — and since the upsert keys on
    // (user_id, measured_on), it would overwrite that day's real
    // measurement instead of recording a new one.
    const measuredOn = await athleteDay(supabase, userId);
    let saved = true;
    try {
      const { error } = await supabase
        .from("body_metrics")
        .upsert(
          { user_id: userId, measured_on: measuredOn, ...measured },
          { onConflict: "user_id,measured_on" },
        );
      if (error) saved = false;
    } catch {
      saved = false;
    }

    return {
      ok: true as const,
      confidence,
      saved,
      bodyFat,
      methods: {
        navy: navy != null ? round1(navy) : null,
        bmi: bmi != null ? round1(bmi) : null,
        visual: visual != null ? round1(visual) : null,
      },
      waistCm: result.waistCm ?? null,
      neckCm: result.neckCm ?? null,
      chestCm: result.chestCm ?? null,
      hipsCm: result.hipsCm ?? null,
      armCm: result.armCm ?? null,
      thighCm: result.thighCm ?? null,
      weightKg,
      leanMassKg,
      fatMassKg,
      bmi: bmiValue,
      waistToHeight: whtr,
      waistToHip: whr,
      summary: result.summary,
    };
  });
