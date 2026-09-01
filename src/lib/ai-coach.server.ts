import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildCoachContext } from "./ai-coach.context";
import { getPerformanceOverviewData } from "./performance.service";
import { getProgressIntelligenceData } from "./progress-intelligence.service";

export async function assembleCoachContext(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  goal?: string | null;
  activePlan?: { id: string; title: string; dayIndex?: number | null } | null;
}) {
  const [performance, intelligence] = await Promise.all([
    getPerformanceOverviewData(args.supabase, args.userId),
    getProgressIntelligenceData(args.supabase, args.userId),
  ]);

  return buildCoachContext({
    userId: args.userId,
    goal: args.goal ?? null,
    activePlan: args.activePlan ?? null,
    performance: {
      workouts: performance.metrics.workouts,
      totalVolume: performance.metrics.totalVolume,
      totalSets: performance.metrics.totalSets,
      totalReps: performance.metrics.totalReps,
      averageRpe: performance.metrics.averageRpe,
      exercises: performance.exercises,
    },
    insights: intelligence.status === "READY" ? intelligence.insights : [],
  });
}
