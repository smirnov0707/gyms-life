import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CoachContext } from "./ai-coach.contract";
import { getActivePlanData } from "./active-plan.service";
import { buildCoachContext } from "./ai-coach.context";
import { loadDeterministicPerformanceForecast } from "./forecast.server";
import { getPerformanceOverviewData } from "./performance.service";

export async function assembleCoachContext(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  goal?: string | null;
  dayIndex?: number | null;
}): Promise<CoachContext> {
  const [performance, performanceForecast, activePlan] = await Promise.all([
    getPerformanceOverviewData(args.supabase, args.userId),
    loadDeterministicPerformanceForecast(args.supabase, args.userId),
    getActivePlanData(args.supabase, args.userId),
  ]);
  const plan = activePlan.status === "READY" ? activePlan.plan : null;

  return buildCoachContext({
    userId: args.userId,
    goal: args.goal ?? plan?.goal ?? null,
    activePlan: plan
      ? {
          id: plan.id,
          title: plan.title,
          dayIndex: args.dayIndex ?? null,
        }
      : null,
    performance,
    performanceForecast,
  });
}
