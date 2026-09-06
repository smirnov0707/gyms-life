import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The stable body facts, and the only place in the app an athlete can state
 * them after signing up.
 *
 * Height, birth year and gender had exactly one entry point — the onboarding
 * form — and until recently that form discarded them. Every account created
 * before then holds nulls, with no screen able to fix it, while the meal plan,
 * the micronutrient scan, the body scan's age term and the hydration target
 * all read these columns.
 *
 * Body weight is deliberately not here. It is a measurement with a date, it
 * already has an entry point in the body metrics panel, and a second input
 * would recreate the very split between a stated and a measured weight that
 * `resolveBodyWeight` exists to settle.
 */
const CURRENT_YEAR = new Date().getUTCFullYear();

export const ProfileBodySchema = z.object({
  /** Matches the range the photo scan accepts as a scale reference. */
  heightCm: z.number().int().min(120).max(230).nullable(),
  birthYear: z
    .number()
    .int()
    .min(CURRENT_YEAR - 100)
    .max(CURRENT_YEAR - 10)
    .nullable(),
  gender: z.enum(["male", "female", "other"]).nullable(),
  targetWeightKg: z.number().min(30).max(300).nullable(),
});

export type ProfileBody = z.infer<typeof ProfileBodySchema>;

export const getProfileBody = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileBody> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("height_cm, birth_year, gender, target_weight_kg")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error(`Could not read your profile: ${error.message}`);

    // A stored value outside the accepted range is reported as missing rather
    // than shown back as if the app stood behind it.
    const parsed = ProfileBodySchema.safeParse({
      heightCm: data?.height_cm ?? null,
      birthYear: data?.birth_year ?? null,
      gender: data?.gender ?? null,
      targetWeightKg: data?.target_weight_kg ?? null,
    });
    if (parsed.success) return parsed.data;
    return { heightCm: null, birthYear: null, gender: null, targetWeightKg: null };
  });

export const saveProfileBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ProfileBodySchema.parse(input))
  .handler(async ({ data, context }) => {
    // The server owns the user id, so a client cannot write another profile.
    const { error } = await context.supabase
      .from("profiles")
      .update({
        height_cm: data.heightCm,
        birth_year: data.birthYear,
        gender: data.gender,
        target_weight_kg: data.targetWeightKg,
      })
      .eq("id", context.userId);

    if (error) throw new Error(`Could not save your profile: ${error.message}`);
    return data;
  });
