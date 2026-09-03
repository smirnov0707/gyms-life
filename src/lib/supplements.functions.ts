import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPPLEMENT_SELECT, SupplementInputSchema, parseSupplements } from "./supplement.schema";

const AddSupplementsInput = z.object({
  supplements: z.array(SupplementInputSchema).min(1).max(8),
  skipExistingNames: z.boolean().default(false),
});

const SupplementIdInput = z.object({ id: z.string().uuid() });
const SetSupplementActiveInput = SupplementIdInput.extend({ isActive: z.boolean() });

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export const getSupplements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("supplements")
      .select(SUPPLEMENT_SELECT)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Supplements lookup failed: ${error.message}`);
    return { supplements: parseSupplements(rows ?? []) };
  });

export const addSupplements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AddSupplementsInput.parse(input))
  .handler(async ({ data, context }) => {
    const unique = new Map<string, (typeof data.supplements)[number]>();
    for (const supplement of data.supplements) {
      unique.set(normalizedName(supplement.name), supplement);
    }

    let entries = [...unique.values()];
    if (data.skipExistingNames) {
      const { data: existing, error: existingError } = await context.supabase
        .from("supplements")
        .select("name")
        .eq("user_id", context.userId);
      if (existingError) {
        throw new Error(`Supplement duplicate lookup failed: ${existingError.message}`);
      }
      const names = new Set((existing ?? []).map((row) => normalizedName(row.name)));
      entries = entries.filter((entry) => !names.has(normalizedName(entry.name)));
    }

    if (!entries.length) return { supplements: [], created: 0 };

    const { data: rows, error } = await context.supabase
      .from("supplements")
      .insert(
        entries.map((entry) => ({
          user_id: context.userId,
          name: entry.name,
          dose: entry.dose || null,
          category: entry.category,
          times_per_day: entry.times_per_day,
          with_food: entry.with_food,
          preferred_time: entry.preferred_time,
          notes: entry.notes || null,
          is_active: entry.is_active,
        })),
      )
      .select(SUPPLEMENT_SELECT);

    if (error) throw new Error(`Could not add supplements: ${error.message}`);
    const supplements = parseSupplements(rows ?? []);
    return { supplements, created: supplements.length };
  });

export const setSupplementActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SetSupplementActiveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("supplements")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(`Could not update supplement: ${error.message}`);
    return { ok: true };
  });

export const removeSupplement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SupplementIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("supplements")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(`Could not remove supplement: ${error.message}`);
    return { ok: true };
  });
