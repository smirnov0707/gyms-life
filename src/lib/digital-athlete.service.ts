import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  BodyMetricSourceSchema,
  CompletedWorkoutSourceSchema,
  DailyCheckinSourceSchema,
  DecisionFeedbackSourceSchema,
  DigitalAthleteSourcesSchema,
  DigitalAthleteStateSchema,
  NutritionLogSourceSchema,
  parseDigitalAthleteRows,
  type DigitalAthleteDataGap,
  type DigitalAthleteSources,
  type DigitalAthleteState,
} from "./digital-athlete.schema";
import { loadActiveLifeContexts } from "./life-context.server";
import type { ActiveLifeContext } from "./life-context.schema";
import { IanaTimeZoneSchema, dayInTimeZone, dayOffset, isDayWithinPastDays } from "./local-day";

const DAY_MS = 86_400_000;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function isWithinPastDays(dateValue: string, days: number, now: Date): boolean {
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp <= now.getTime() && timestamp >= now.getTime() - days * DAY_MS;
}

function daysSince(dateValue: string | undefined, now: Date): number | null {
  if (!dateValue) return null;
  const timestamp = Date.parse(dateValue);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return null;
  return Math.floor((now.getTime() - timestamp) / DAY_MS);
}

function dataQualityFor(
  sources: DigitalAthleteSources,
  recentEvidence: {
    workouts: number;
    checkins: number;
    bodyMetrics: number;
    nutritionLogs: number;
  },
): DigitalAthleteState["dataQuality"] {
  const evidenceCount =
    recentEvidence.workouts +
    recentEvidence.checkins +
    recentEvidence.bodyMetrics +
    recentEvidence.nutritionLogs;
  const availableDomains = (["training", "recovery", "body", "nutrition"] as const).filter(
    (domain) => sources.availability[domain],
  );
  const hasMeaningfulTraining = recentEvidence.workouts >= 3;
  const hasMeaningfulRecovery = recentEvidence.checkins >= 3;
  const hasMeaningfulBody = recentEvidence.bodyMetrics >= 2;
  const hasMeaningfulNutrition = recentEvidence.nutritionLogs >= 5;
  const level =
    evidenceCount === 0
      ? "cold_start"
      : hasMeaningfulTraining &&
          hasMeaningfulRecovery &&
          (hasMeaningfulBody || hasMeaningfulNutrition)
        ? "informed"
        : "building";

  return { level, evidenceCount, availableDomains };
}

function currentContextFor(
  contexts: ActiveLifeContext[],
  now: Date,
): DigitalAthleteState["currentContext"] {
  const active = contexts.filter((context) => Date.parse(context.expiresAt) > now.getTime());
  const timeBudgets = active.flatMap((context) =>
    context.context.kind === "time_limited" ? [context.context.minutes] : [],
  );
  return {
    active,
    shortestAvailableSessionMinutes: timeBudgets.length ? Math.min(...timeBudgets) : null,
    hasTrainingConstraint: active.some(
      (context) =>
        context.context.kind === "travel" ||
        context.context.kind === "time_limited" ||
        context.context.kind === "equipment_limited" ||
        context.context.kind === "facility_closed" ||
        context.context.kind === "high_stress",
    ),
    hasSafetyConstraint: active.some((context) => context.context.kind === "temporary_limitation"),
  };
}

function decisionFeedbackFor(
  outcomes: DigitalAthleteSources["decisionFeedback"],
  available: boolean,
  now: Date,
  timeZone: string,
): DigitalAthleteState["decisionFeedback"] {
  if (!available) {
    return {
      available: false,
      ratedDecisionsLast28Days: 0,
      helpfulDecisionOutcomesLast28Days: 0,
      notHelpfulDecisionOutcomesLast28Days: 0,
      helpfulnessRate: null,
    };
  }

  const today = dayInTimeZone(now, timeZone);
  const recent = outcomes.filter((outcome) => isDayWithinPastDays(outcome.decision_on, 28, today));
  const helpful = recent.filter(
    (outcome) => outcome.outcome === "accepted" || outcome.outcome === "completed",
  ).length;
  const notHelpful = recent.filter(
    (outcome) => outcome.outcome === "dismissed" || outcome.outcome === "not_helpful",
  ).length;
  const rated = helpful + notHelpful;

  return {
    available: true,
    ratedDecisionsLast28Days: rated,
    helpfulDecisionOutcomesLast28Days: helpful,
    notHelpfulDecisionOutcomesLast28Days: notHelpful,
    // Three explicit outcomes are the minimum before feedback influences a
    // confidence label. It never changes a safety decision or training load.
    helpfulnessRate: rated >= 3 ? roundToTwoDecimals(helpful / rated) : null,
  };
}

const DecisionFeedbackRelationSchema = z
  .object({
    outcome: z.unknown(),
  })
  .strict();

const DecisionFeedbackJoinRowSchema = z
  .object({
    decision_on: z.unknown(),
    decision_outcomes: z.union([
      DecisionFeedbackRelationSchema,
      z.array(DecisionFeedbackRelationSchema).max(1),
      z.null(),
    ]),
  })
  .strict();

function parseDecisionFeedbackRows(value: unknown): {
  rows: DigitalAthleteSources["decisionFeedback"];
  valid: boolean;
} {
  const parsedJoinRows = z.array(DecisionFeedbackJoinRowSchema).safeParse(value ?? []);
  if (!parsedJoinRows.success) return { rows: [], valid: false };

  const flattened = parsedJoinRows.data.flatMap((row) => {
    const relation = Array.isArray(row.decision_outcomes)
      ? (row.decision_outcomes[0] ?? null)
      : row.decision_outcomes;
    return relation === null ? [] : [{ decision_on: row.decision_on, outcome: relation.outcome }];
  });
  return parseDigitalAthleteRows(DecisionFeedbackSourceSchema, flattened);
}

/**
 * Builds the app-owned digital athlete state from narrow, validated source
 * rows. It is deterministic: AI may interpret this state, but never creates
 * or alters the underlying facts.
 */
export function buildDigitalAthleteState(
  sourceValue: DigitalAthleteSources,
  now = new Date(),
  timeZone = "UTC",
): DigitalAthleteState {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const today = dayInTimeZone(now, zone);
  const sources = DigitalAthleteSourcesSchema.parse(sourceValue);
  const newestFirst = <
    T extends { started_at?: string; checkin_on?: string; measured_on?: string },
  >(
    rows: T[],
  ): T[] =>
    [...rows].sort((left, right) => {
      const leftDate = left.started_at ?? left.checkin_on ?? left.measured_on ?? "";
      const rightDate = right.started_at ?? right.checkin_on ?? right.measured_on ?? "";
      return rightDate.localeCompare(leftDate);
    });
  const completedWorkouts = newestFirst(
    sources.workouts.filter((workout) => isWithinPastDays(workout.started_at, 365, now)),
  );
  const workoutsLast7Days = completedWorkouts.filter((workout) =>
    isWithinPastDays(workout.started_at, 7, now),
  );
  const workoutsLast28Days = completedWorkouts.filter((workout) =>
    isWithinPastDays(workout.started_at, 28, now),
  );
  const checkinsLast7Days = newestFirst(
    sources.checkins.filter((checkin) => isDayWithinPastDays(checkin.checkin_on, 7, today)),
  );
  const bodyMetricsLast30Days = newestFirst(
    sources.bodyMetrics.filter((metric) => isDayWithinPastDays(metric.measured_on, 30, today)),
  );
  const nutritionLogsLast14Days = sources.nutritionLogs.filter((log) =>
    isDayWithinPastDays(log.logged_on, 14, today),
  );
  const latestWorkout = completedWorkouts[0];
  const latestCheckin = checkinsLast7Days[0];
  const latestBodyMetric = bodyMetricsLast30Days[0];
  const weights = bodyMetricsLast30Days.flatMap((metric) =>
    metric.weight_kg === null ? [] : [metric.weight_kg],
  );
  const latestWeight = weights[0] ?? null;
  const earliestWeight = weights.at(-1) ?? null;
  const weightChange =
    latestWeight !== null && earliestWeight !== null && weights.length >= 2
      ? roundToOneDecimal(latestWeight - earliestWeight)
      : null;
  const dataGaps: DigitalAthleteDataGap[] = [];

  if (!sources.availability.training) dataGaps.push("training_data_unavailable");
  else if (workoutsLast28Days.length === 0) dataGaps.push("no_completed_workouts_28d");
  if (!sources.availability.recovery) dataGaps.push("recovery_data_unavailable");
  else if (checkinsLast7Days.length === 0) dataGaps.push("no_recovery_checkins_7d");
  if (!sources.availability.body) dataGaps.push("body_measurements_unavailable");
  else if (bodyMetricsLast30Days.length === 0) dataGaps.push("no_body_measurements_30d");
  if (!sources.availability.nutrition) dataGaps.push("nutrition_data_unavailable");
  else if (nutritionLogsLast14Days.length === 0) dataGaps.push("no_nutrition_logs_14d");
  if (!sources.availability.context) dataGaps.push("current_context_unavailable");

  return DigitalAthleteStateSchema.parse({
    schemaVersion: "1.2",
    training: {
      sessionsLast7Days: workoutsLast7Days.length,
      sessionsLast28Days: workoutsLast28Days.length,
      totalVolumeLast28Days: roundToOneDecimal(
        workoutsLast28Days.reduce((sum, workout) => sum + workout.total_volume, 0),
      ),
      daysSinceLastCompletedWorkout: daysSince(latestWorkout?.started_at, now),
    },
    recovery: {
      checkinsLast7Days: checkinsLast7Days.length,
      latestReadinessScore: latestCheckin?.readiness_score ?? null,
      averageReadinessLast7Days: average(
        checkinsLast7Days.flatMap((checkin) =>
          checkin.readiness_score === null ? [] : [checkin.readiness_score],
        ),
      ),
      averageSleepHoursLast7Days: average(
        checkinsLast7Days.flatMap((checkin) =>
          checkin.sleep_hours === null ? [] : [checkin.sleep_hours],
        ),
      ),
    },
    body: {
      measurementsLast30Days: bodyMetricsLast30Days.length,
      latestWeightKg: latestBodyMetric?.weight_kg ?? null,
      latestBodyFatPercent: latestBodyMetric?.body_fat ?? null,
      weightChangeKgLast30Days: weightChange,
    },
    nutrition: {
      loggedDaysLast14Days: new Set(nutritionLogsLast14Days.map((log) => log.logged_on)).size,
      averageCaloriesOnLoggedDays: average(nutritionLogsLast14Days.map((log) => log.calories)),
      averageProteinGOnLoggedDays: average(nutritionLogsLast14Days.map((log) => log.protein)),
    },
    decisionFeedback: decisionFeedbackFor(
      sources.decisionFeedback,
      sources.availability.decisionFeedback,
      now,
      zone,
    ),
    currentContext: currentContextFor(sources.lifeContexts, now),
    dataQuality: dataQualityFor(sources, {
      workouts: workoutsLast28Days.length,
      checkins: checkinsLast7Days.length,
      bodyMetrics: bodyMetricsLast30Days.length,
      nutritionLogs: nutritionLogsLast14Days.length,
    }),
    dataGaps,
  });
}

/**
 * Loads only the fields the digital athlete contract needs, validates each
 * result at the Supabase boundary, and degrades one unavailable domain to a
 * data gap instead of letting it corrupt every downstream AI feature.
 */
export async function loadDigitalAthleteState(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
  timeZone = "UTC",
): Promise<DigitalAthleteState> {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const today = dayInTimeZone(now, zone);
  const bodyMetricsSince = dayOffset(today, -30);
  const nutritionSince = dayOffset(today, -14);
  const decisionFeedbackSince = dayOffset(today, -28);
  const [
    workoutsResult,
    checkinsResult,
    bodyMetricsResult,
    nutritionLogsResult,
    decisionFeedbackResult,
    lifeContextResult,
  ] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("started_at, total_volume")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(60),
    supabase
      .from("daily_checkins")
      .select("checkin_on, readiness_score, sleep_hours")
      .eq("user_id", userId)
      .order("checkin_on", { ascending: false })
      .limit(14),
    supabase
      .from("body_metrics")
      .select("measured_on, weight_kg, body_fat")
      .eq("user_id", userId)
      .gte("measured_on", bodyMetricsSince)
      .order("measured_on", { ascending: false })
      .limit(60),
    supabase
      .from("nutrition_logs")
      .select("logged_on, calories, protein")
      .eq("user_id", userId)
      .gte("logged_on", nutritionSince)
      .order("logged_on", { ascending: false })
      .limit(280),
    supabase
      .from("decision_records")
      .select("decision_on, decision_outcomes(outcome)")
      .eq("user_id", userId)
      .gte("decision_on", decisionFeedbackSince)
      .order("decision_on", { ascending: false })
      .limit(56),
    loadActiveLifeContexts(supabase, userId, now),
  ]);

  const workouts = parseDigitalAthleteRows(CompletedWorkoutSourceSchema, workoutsResult.data);
  const checkins = parseDigitalAthleteRows(DailyCheckinSourceSchema, checkinsResult.data);
  const bodyMetrics = parseDigitalAthleteRows(BodyMetricSourceSchema, bodyMetricsResult.data);
  const nutritionLogs = parseDigitalAthleteRows(NutritionLogSourceSchema, nutritionLogsResult.data);
  const decisionFeedback = parseDecisionFeedbackRows(decisionFeedbackResult.data);

  return buildDigitalAthleteState(
    {
      workouts: workouts.rows,
      checkins: checkins.rows,
      bodyMetrics: bodyMetrics.rows,
      nutritionLogs: nutritionLogs.rows,
      decisionFeedback: decisionFeedback.rows,
      lifeContexts: lifeContextResult.contexts,
      availability: {
        training: workoutsResult.error === null && workouts.valid,
        recovery: checkinsResult.error === null && checkins.valid,
        body: bodyMetricsResult.error === null && bodyMetrics.valid,
        nutrition: nutritionLogsResult.error === null && nutritionLogs.valid,
        decisionFeedback: decisionFeedbackResult.error === null && decisionFeedback.valid,
        context: lifeContextResult.available,
      },
    },
    now,
    zone,
  );
}
