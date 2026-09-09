import { useAuth } from "./auth";
import type { Tables } from "@/integrations/supabase/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { localizeMealPlan } from "./meal-i18n.functions";
import { useI18n } from "./i18n";
import type { GeneratedMealPlan } from "./meal-types";

/**
 * Returns the saved meal plan rendered in the currently selected UI language.
 * The stored plan is translated once per language and cached in the database.
 */
export function useLocalizedMealPlan(
  planId: string | undefined,
  base: GeneratedMealPlan | null | undefined,
  sourceLang: string | undefined,
  revision?: string,
) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const client = useQueryClient();
  const run = useServerFn(localizeMealPlan);
  const needs = Boolean(planId && base && sourceLang && sourceLang !== lang);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["meal-plan-i18n", planId, lang, revision],
    queryFn: async () => {
      try {
        const res = await run({
          data: { planId: planId!, lang, ...(revision ? { revision } : {}) },
        });
        if (user && revision && res.updatedAt && res.updatedAt !== revision) {
          type MealRow = Pick<
            Tables<"meal_plans">,
            "id" | "data" | "lang" | "created_at" | "updated_at"
          >;
          client.setQueryData<MealRow>(["meal-plan", user.id], (previous) =>
            previous && previous.id === planId && previous.updated_at === revision
              ? { ...previous, updated_at: res.updatedAt }
              : previous,
          );
        }
        return res.plan;
      } catch (error) {
        if (error instanceof Error && error.message.includes("MEAL_PLAN_CHANGED"))
          await client.invalidateQueries({ queryKey: ["meal-plan", user?.id] });
        throw error;
      }
    },
    enabled: needs,
    staleTime: Infinity,
  });

  return {
    plan: (needs ? data : base) ?? base ?? null,
    translating: needs && isFetching && !data,
    translationFailed: needs && isError,
  };
}
