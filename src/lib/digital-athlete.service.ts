import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  BodyMetricSourceSchema,
  CompletedWorkoutSourceSchema,
  DailyCheckinSourceSchema,
  DigitalAthleteSourcesSchema,
  DigitalAthleteStateSchema,
  NutritionLogSourceSchema,
  parseDigitalAthleteRows,
  type DigitalAthleteDataGap,
  type DigitalAthleteSources,
  type DigitalAthleteState,
} from "./digital-athlete.schema";

const DAY_MS = 86_400_000;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
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

/**
 * Builds the app-owned digital athlete state from narrow, validated source
 * rows. It is deterministic: AI may interpret this state, but never creates
 * or alters the underlying facts.
 */
export function buildDigitalAthleteState(
  sourceValue: DigitalAthleteSources,
  now = new Date(),
): DigitalAthleteState {
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
    sources.checkins.filter((checkin) => isWithinPastDays(checkin.checkin_on, 7, now)),
  );
  const bodyMetricsLast30Days = newestFirst(
    sources.bodyMetrics.filter((metric) => isWithinPastDays(metric.measured_on, 30, now)),
  );
  const nutritionLogsLast14Days = sources.nutritionLogs.filter((log) =>
    isWithinPastDays(log.logged_on, 14, now),
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

  return DigitalAthleteStateSchema.parse({
    schemaVersion: "1.0",
    training: {
      sessionsLast7Days: workoutsLast7Days.length,
      sessionsLast28Days: workoutsLast28Days.length,
      totalVolumeLast28Days: roundToOneDecimal(
        workoutsLast28Days.reduce((sum, workout) => sum + workout.total_volume, 0),
      ),
      daysSinceLastCompletedWorkout: daysSince(latestWorkout?.started_at, now),
    },
    recovery: {
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
      latestWeightKg: latestBodyMetric?.weight_kg ?? null,
      latestBodyFatPercent: latestBodyMetric?.body_fat ?? null,
      weightChangeKgLast30Days: weightChange,
    },
    nutrition: {
      loggedDaysLast14Days: new Set(nutritionLogsLast14Days.map((log) => log.logged_on)).size,
      averageCaloriesOnLoggedDays: average(nutritionLogsLast14Days.map((log) => log.calories)),
      averageProteinGOnLoggedDays: average(nutritionLogsLast14Days.map((log) => log.protein)),
    },
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
): Promise<DigitalAthleteState> {
  const bodyMetricsSince = new Date(now.getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
  const nutritionSince = new Date(now.getTime() - 14 * DAY_MS).toISOString().slice(0, 10);
  const [workoutsResult, checkinsResult, bodyMetricsResult, nutritionLogsResult] =
    await Promise.all([
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
    ]);

  const workouts = parseDigitalAthleteRows(CompletedWorkoutSourceSchema, workoutsResult.data);
  const checkins = parseDigitalAthleteRows(DailyCheckinSourceSchema, checkinsResult.data);
  const bodyMetrics = parseDigitalAthleteRows(BodyMetricSourceSchema, bodyMetricsResult.data);
  const nutritionLogs = parseDigitalAthleteRows(NutritionLogSourceSchema, nutritionLogsResult.data);

  return buildDigitalAthleteState(
    {
      workouts: workouts.rows,
      checkins: checkins.rows,
      bodyMetrics: bodyMetrics.rows,
      nutritionLogs: nutritionLogs.rows,
      availability: {
        training: workoutsResult.error === null && workouts.valid,
        recovery: checkinsResult.error === null && checkins.valid,
        body: bodyMetricsResult.error === null && bodyMetrics.valid,
        nutrition: nutritionLogsResult.error === null && nutritionLogs.valid,
      },
    },
    now,
  );
}
