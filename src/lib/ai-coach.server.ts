import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CoachContext } from "./ai-coach.contract";
import { getActivePlanData } from "./active-plan.service";
import { buildCoachContext } from "./ai-coach.context";
import { loadDeterministicPerformanceForecast } from "./forecast.server";
import { getPerformanceOverviewData } from "./performance.service";
import { loadActiveRacePrep } from "./endurance-race-prep.service";
import { loadLatestPostRunBrief } from "./endurance-post-run.service";
import { dayInTimeZone } from "./local-day";

export async function assembleCoachContext(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  goal?: string | null;
  dayIndex?: number | null;
}): Promise<CoachContext> {
  const today = dayInTimeZone(new Date(), "UTC");
  const [performance, performanceForecast, activePlan, racePrep, postRun] = await Promise.all([
    getPerformanceOverviewData(args.supabase, args.userId),
    loadDeterministicPerformanceForecast(args.supabase, args.userId),
    getActivePlanData(args.supabase, args.userId),
    loadActiveRacePrep(args.supabase, args.userId, today).catch(() => ({ status: "none" as const })),
    loadLatestPostRunBrief(args.supabase, args.userId).catch(() => ({ status: "none" as const })),
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
    endurance: racePrep.status === "active" ? {
      active: true,
      raceDistance: racePrep.raceDistance,
      daysToRace: racePrep.daysToRace,
      phase: racePrep.currentWeek.phase,
      readiness: racePrep.readiness.status,
      evidenceLevel: racePrep.readiness.evidenceLevel,
      nextSession: racePrep.nextSession ? {
        intent: racePrep.nextSession.intent,
        distanceMeters: racePrep.nextSession.plannedDistanceMeters,
        durationMinutes: racePrep.nextSession.plannedDurationMinutes,
        intensityCue: racePrep.nextSession.intensityCue,
      } : null,
      postRun: postRun.status === "ready" ? {
        headline: postRun.brief.headline,
        nextAction: postRun.brief.nextAction,
        facts: postRun.brief.facts,
      } : null,
      prohibitedClaims: ["diagnosis", "injury_prediction_without_evidence", "guaranteed_race_time", "vo2max_without_measurement", "override_deterministic_training_decision"],
    } : undefined,
  });
}
