import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const SupplementCategorySchema = z.enum([
  "protein",
  "creatine",
  "vitamin",
  "mineral",
  "iron",
  "calcium",
  "omega",
  "preworkout",
  "electrolyte",
  "probiotic",
  "general",
]);

export const SupplementPreferredTimeSchema = z.enum([
  "any",
  "morning",
  "pre_workout",
  "post_workout",
  "evening",
  "bedtime",
]);

export const SUPPLEMENT_SELECT =
  "id, name, dose, category, times_per_day, with_food, preferred_time, notes, is_active";

export type SupplementRow = Pick<
  Tables<"supplements">,
  | "id"
  | "name"
  | "dose"
  | "category"
  | "times_per_day"
  | "with_food"
  | "preferred_time"
  | "notes"
  | "is_active"
>;

export const SupplementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().max(120).nullable(),
  category: SupplementCategorySchema.catch("general"),
  times_per_day: z.number().int().min(1).max(6),
  with_food: z.boolean(),
  preferred_time: SupplementPreferredTimeSchema.catch("any"),
  notes: z.string().trim().max(500).nullable(),
  is_active: z.boolean(),
});

export type Supplement = z.infer<typeof SupplementSchema>;

export const SupplementInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().max(120).default(""),
  category: SupplementCategorySchema.default("general"),
  times_per_day: z.coerce.number().int().min(1).max(4).default(1),
  with_food: z.boolean().default(false),
  preferred_time: SupplementPreferredTimeSchema.default("any"),
  notes: z.string().trim().max(500).default(""),
  is_active: z.boolean().default(true),
});

export type SupplementInput = z.infer<typeof SupplementInputSchema>;

export function parseSupplement(row: SupplementRow): Supplement {
  return SupplementSchema.parse(row);
}

/** Invalid historical rows cannot enter the client schedule or supplement UI. */
export function parseSupplements(rows: SupplementRow[]): Supplement[] {
  return rows.flatMap((row) => {
    const parsed = SupplementSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
