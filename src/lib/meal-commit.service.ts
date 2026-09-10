import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import type { GeneratedMealPlan } from "./meal-plan.schema";
import { serializeJson } from "./json.schema";
import { MealPreferencesSchema } from "./meal-preferences.schema";
import type { SupportedLanguage } from "./language.schema";
const Result = z
  .array(
    z.object({
      plan_id: z.string().uuid(),
      created_at: z.string().datetime({ offset: true }),
      updated_at: z.string().datetime({ offset: true }),
    }),
  )
  .length(1);
/** Database transaction is the only successful generation persistence path. */
export async function commitGeneratedMealPlan(
  client: SupabaseClient<Database>,
  input: {
    planId: string;
    profileUpdatedAt: string;
    plan: GeneratedMealPlan;
    preferences: z.infer<typeof MealPreferencesSchema>;
    lang: SupportedLanguage;
  },
) {
  const { data, error } = await client.rpc("commit_generated_meal_plan", {
    p_plan_id: input.planId,
    p_profile_updated_at: input.profileUpdatedAt,
    p_plan: serializeJson(input.plan),
    p_preferences: serializeJson(input.preferences),
    p_lang: input.lang,
  });
  if (error) {
    if (error.message.includes("MEAL_PROFILE_CHANGED")) throw new Error("MEAL_PROFILE_CHANGED");
    throw new Error("MEAL_PLAN_COMMIT_FAILED");
  }
  const result = Result.parse(data)[0]!;
  if (result.plan_id !== input.planId) throw new Error("MEAL_PLAN_COMMIT_UNCONFIRMED");
  return { id: result.plan_id, createdAt: result.created_at, updatedAt: result.updated_at };
}
