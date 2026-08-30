import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { localizePlan } from "./plan-i18n.functions";
import { useI18n } from "./i18n";
import type { PlanData } from "./plan-types";

/**
 * Returns the plan rendered in the currently selected UI language.
 * The stored plan is translated once per language and cached in the database.
 */
export function useLocalizedPlan(
  planId: string | undefined,
  base: PlanData | undefined,
  sourceLang: string | undefined,
) {
  const { lang } = useI18n();
  const run = useServerFn(localizePlan);
  const needs = Boolean(planId && base && sourceLang && sourceLang !== lang);

  const { data, isFetching } = useQuery({
    queryKey: ["plan-i18n", planId, lang],
    queryFn: async () => {
      const res = await run({ data: { planId: planId!, lang: lang as never } });
      return res.plan as PlanData;
    },
    enabled: needs,
    staleTime: Infinity,
  });

  return { plan: (needs ? data : base) ?? base, translating: needs && isFetching && !data };
}
