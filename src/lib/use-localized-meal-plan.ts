import { useQuery } from "@tanstack/react-query";
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
) {
  const { lang } = useI18n();
  const run = useServerFn(localizeMealPlan);
  const needs = Boolean(planId && base && sourceLang && sourceLang !== lang);

  const { data, isFetching } = useQuery({
    queryKey: ["meal-plan-i18n", planId, lang],
    queryFn: async () => {
      const res = await run({ data: { planId: planId!, lang } });
      return res.plan;
    },
    enabled: needs,
    staleTime: Infinity,
  });

  return {
    plan: (needs ? data : base) ?? base ?? null,
    translating: needs && isFetching && !data,
  };
}
