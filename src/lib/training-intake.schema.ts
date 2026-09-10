import { z } from "zod";
import { SupportedLanguageSchema } from "./language.schema";
import { CanonicalWorkoutEquipmentSchema } from "./workout-equipment.schema";

/** Shared form/server bounds; blank body data stays unknown, never a default body. */
export const TrainingIntakeSchema = z.object({
  goal: z.enum(["lose_fat", "build_muscle", "strength", "endurance", "lose", "muscle", "recomp"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  location: z.enum(["home", "gym", "both"]),
  equipment: z
    .array(CanonicalWorkoutEquipmentSchema)
    .max(12)
    .transform((values) => [...new Set(values)]),
  daysPerWeek: z.number().finite().int().min(1).max(7),
  sessionMinutes: z.number().finite().int().min(15).max(120),
  planWeeks: z.number().finite().int().min(4).max(24).default(8),
  age: z.number().finite().int().min(10).max(100).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  heightCm: z.number().finite().min(120).max(230).nullable().optional(),
  weightKg: z.number().finite().min(30).max(300).nullable().optional(),
  targetWeightKg: z.number().finite().min(30).max(300).nullable().optional(),
  limitations: z.string().trim().max(1000).nullable().optional(),
  lang: SupportedLanguageSchema.default("lt"),
});
export type Intake = z.infer<typeof TrainingIntakeSchema>;
export function optionalFormNumber(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned.replace(",", "."));
}
