import { z } from "zod";

export const WorkoutEquipmentSchema = z.enum([
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
]);

export type WorkoutEquipment = z.infer<typeof WorkoutEquipmentSchema>;

/**
 * Labels belong in the UI, but the values belong here so a temporary life
 * context, the catalog, and workout execution share one vocabulary.
 */
export const TemporaryEquipmentChoices = [
  "bodyweight",
  "dumbbell",
  "band",
  "kettlebell",
  "pullup_bar",
  "barbell",
  "cable",
  "machine",
] as const satisfies readonly WorkoutEquipment[];

const EQUIPMENT_ALIASES: Readonly<Record<string, WorkoutEquipment>> = {
  bands: "band",
  dumbbells: "dumbbell",
  kettlebells: "kettlebell",
  pull_up_bar: "pullup_bar",
  resistance_band: "band",
  resistance_bands: "band",
};

/** Converts catalog and legacy user spellings into the canonical equipment id. */
export function canonicalWorkoutEquipment(value: string): WorkoutEquipment | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const candidate = EQUIPMENT_ALIASES[normalized] ?? normalized;
  const parsed = WorkoutEquipmentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Accepts a small set of legacy aliases at the boundary, but returns only
 * canonical ids to the domain model and persisted context.
 */
export const CanonicalWorkoutEquipmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value) => canonicalWorkoutEquipment(value))
  .pipe(WorkoutEquipmentSchema);

export const AvailableWorkoutEquipmentSchema = z
  .array(CanonicalWorkoutEquipmentSchema)
  .min(1)
  .max(12)
  .superRefine((values, ctx) => {
    if (new Set(values).size === values.length) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Equipment choices must be unique.",
    });
  });
