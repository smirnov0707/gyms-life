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
  WorkoutResponseSourceSchema,
  parseDigitalAthleteRows,
  type DigitalAthleteDataGap,
  type DigitalAthleteSources,
  type DigitalAthleteState,
} from "./digital-athlete.schema";
import { loadActiveLifeContexts } from "./life-context.server";
import type { ActiveLifeContext } from "./life-context.schema";
import { calculateMuscleGroupLoad } from "./muscle-load.engine";
import { MuscleLoadExerciseSourceSchema, MuscleLoadSetSourceSchema } from "./muscle-load.schema";
import {
  IanaTimeZoneSchema,
  dayInTimeZone,
  dayOffset,
  isDayWithinPastDays,
  weekdayForDay,
} from "./local-day";
import { loadTrainingRhythm } from "./training-rhythm.server";
import type { TrainingRhythm } from "./training-rhythm.schema";
import { LOW_WORKOUT_FEELING_THRESHOLD } from "./training-response.schema";

const DAY_MS = 86_400_000;

/**
 * Identifies the deterministic calculation logic that produced a Digital
 * Athlete state, independent of `DigitalAthleteStateSchema.schemaVersion`
 * (which versions the stored shape, not the derivation logic). Bump this
 * when the calculation rules below change in a way that could explain a
 * different state for the same underlying facts.
 */
export const DIGITAL_ATHLETE_CALCULATION_VERSION = "digital-athlete-v1" as const;

/** The widest lookback any domain calculation below uses (body metrics, 30 days). */
export const DIGITAL_ATHLETE_MAX_LOOKBACK_DAYS = 30;

/**
 * How far back muscle-load set logs are fetched. Matches the engine's 40h
 * fatigue-decay half-life: older sets barely register. Exported so any
 * consumer of `muscleLoad` (e.g. the Digital Twin mapper) can state the
 * evidence window truthfully instead of guessing or re-hardcoding it.
 */
export const MUSCLE_LOAD_LOOKBACK_DAYS = 7;

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

function recentLowFeelingStreak(responses: DigitalAthleteSources["workoutResponses"]): number {
  let streak = 0;
  for (const response of responses) {
    if (response.feeling === null || response.feeling > LOW_WORKOUT_FEELING_THRESHOLD) break;
    streak += 1;
  }
  return streak;
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

function trainingBehaviorFor(
  workouts: DigitalAthleteSources["workouts"],
  trainingRhythm: TrainingRhythm | null,
  available: boolean,
  today: string,
  timeZone: string,
): DigitalAthleteState["behavior"] {
  if (!available) {
    return {
      status: "unavailable",
      preferredWeekdays: [],
      usualTrainingDaysLast28Days: null,
      completedUsualTrainingDaysLast28Days: null,
      completedFlexibleTrainingDaysLast28Days: null,
      usualDayCompletionRateLast28Days: null,
    };
  }

  if (trainingRhythm === null) {
    return {
      status: "not_configured",
      preferredWeekdays: [],
      usualTrainingDaysLast28Days: null,
      completedUsualTrainingDaysLast28Days: null,
      completedFlexibleTrainingDaysLast28Days: null,
      usualDayCompletionRateLast28Days: null,
    };
  }

  // Excluding the still-open local day avoids calling an uncompleted usual day
  // a miss. This is an observation window, not a required workout calendar.
  const windowDays = 28;
  const firstDay = dayOffset(today, -windowDays);
  const completedWindowDays = Array.from({ length: windowDays }, (_, index) =>
    dayOffset(firstDay, index),
  );
  const lastDay = completedWindowDays.at(-1);
  if (lastDay === undefined) throw new Error("Training behavior window is unexpectedly empty.");

  const preferredWeekdays = new Set(trainingRhythm.preferredWeekdays);
  const usualDays = completedWindowDays.filter((day) =>
    preferredWeekdays.has(weekdayForDay(day, timeZone)),
  );
  const completedWorkoutDays = new Set(
    workouts.flatMap((workout) => {
      const workoutDay = dayInTimeZone(new Date(workout.started_at), timeZone);
      return workoutDay >= firstDay && workoutDay <= lastDay ? [workoutDay] : [];
    }),
  );
  const completedUsualDays = usualDays.filter((day) => completedWorkoutDays.has(day)).length;
  const completedFlexibleDays = [...completedWorkoutDays].filter(
    (day) => !preferredWeekdays.has(weekdayForDay(day, timeZone)),
  ).length;

  return {
    status: "measured",
    preferredWeekdays: trainingRhythm.preferredWeekdays,
    usualTrainingDaysLast28Days: usualDays.length,
    completedUsualTrainingDaysLast28Days: completedUsualDays,
    completedFlexibleTrainingDaysLast28Days: completedFlexibleDays,
    usualDayCompletionRateLast28Days: roundToTwoDecimals(completedUsualDays / usualDays.length),
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
  const ratedWorkoutResponsesLast28Days = newestFirst(
    sources.workoutResponses.filter(
      (response) => response.feeling !== null && isWithinPastDays(response.started_at, 28, now),
    ),
  );
  const lowFeelingStreak = sources.availability.trainingResponse
    ? recentLowFeelingStreak(ratedWorkoutResponsesLast28Days)
    : 0;
  const checkinsLast7Days = newestFirst(
    sources.checkins.filter((checkin) => isDayWithinPastDays(checkin.checkin_on, 7, today)),
  );
  const bodyMetricsLast30Days = newestFirst(
    sources.bodyMetrics.filter((metric) => isDayWithinPastDays(metric.measured_on, 30, today)),
  );
  const nutritionLogsLast14Days = sources.nutritionLogs.filter((log) =>
    isDayWithinPastDays(log.logged_on, 14, today),
  );
  const hasCompletedReadiness = sources.checkins.some(
    (checkin) => checkin.checkin_on === today && checkin.readiness_score !== null,
  );
  const hasCompletedWorkout = completedWorkouts.some(
    (workout) => dayInTimeZone(new Date(workout.started_at), zone) === today,
  );
  const hasLoggedNutrition = sources.nutritionLogs.some((log) => log.logged_on === today);
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
  // Unlike the domains above, an empty result here is not its own gap: it is
  // the same underlying fact as no_completed_workouts_28d, not new evidence
  // of a missing source.
  if (!sources.availability.muscleLoad) dataGaps.push("muscle_load_data_unavailable");
  if (!sources.availability.context) dataGaps.push("current_context_unavailable");
  if (!sources.availability.trainingRhythm) dataGaps.push("training_rhythm_data_unavailable");

  const muscleLoad = sources.availability.muscleLoad
    ? calculateMuscleGroupLoad(sources.setLogs, sources.exerciseMuscleGroups, now)
    : [];

  return DigitalAthleteStateSchema.parse({
    schemaVersion: "1.7",
    training: {
      sessionsLast7Days: workoutsLast7Days.length,
      sessionsLast28Days: workoutsLast28Days.length,
      totalVolumeLast28Days: roundToOneDecimal(
        workoutsLast28Days.reduce((sum, workout) => sum + workout.total_volume, 0),
      ),
      daysSinceLastCompletedWorkout: daysSince(latestWorkout?.started_at, now),
      selfReportedResponse: {
        source: "user_reported",
        available: sources.availability.trainingResponse,
        ratedSessionsLast28Days: sources.availability.trainingResponse
          ? ratedWorkoutResponsesLast28Days.length
          : 0,
        latestFeeling: sources.availability.trainingResponse
          ? (ratedWorkoutResponsesLast28Days[0]?.feeling ?? null)
          : null,
        averageFeelingLast28Days: sources.availability.trainingResponse
          ? average(
              ratedWorkoutResponsesLast28Days.flatMap((response) =>
                response.feeling === null ? [] : [response.feeling],
              ),
            )
          : null,
        recentLowFeelingStreak: lowFeelingStreak,
      },
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
    currentDay: {
      day: today,
      weekday: weekdayForDay(today, zone),
      hasCompletedReadiness,
      hasCompletedWorkout,
      hasLoggedNutrition,
    },
    behavior: trainingBehaviorFor(
      completedWorkouts,
      sources.trainingRhythm,
      sources.availability.training && sources.availability.trainingRhythm,
      today,
      zone,
    ),
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
    muscleLoad,
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
  const muscleLoadSince = new Date(
    now.getTime() - MUSCLE_LOAD_LOOKBACK_DAYS * DAY_MS,
  ).toISOString();
  const [
    workoutsResult,
    workoutResponsesResult,
    checkinsResult,
    bodyMetricsResult,
    nutritionLogsResult,
    decisionFeedbackResult,
    lifeContextResult,
    trainingRhythmResult,
    setLogsResult,
    exerciseMuscleGroupsResult,
  ] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("started_at, total_volume")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(60),
    supabase
      .from("workout_sessions")
      .select("started_at, feeling")
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
    loadTrainingRhythm(supabase, userId)
      .then((trainingRhythm) => ({ trainingRhythm, available: true }))
      .catch(() => ({ trainingRhythm: null, available: false })),
    supabase
      .from("set_logs")
      .select("exercise_slug, reps, weight_kg, done, created_at")
      .eq("user_id", userId)
      .gte("created_at", muscleLoadSince)
      .order("created_at", { ascending: false })
      .limit(500),
    // The exercise catalog is a small, shared reference table (not
    // user-owned): every row is needed to classify any logged set correctly.
    supabase.from("exercises").select("slug, muscle_group"),
  ]);

  const workouts = parseDigitalAthleteRows(CompletedWorkoutSourceSchema, workoutsResult.data);
  const workoutResponses = parseDigitalAthleteRows(
    WorkoutResponseSourceSchema,
    workoutResponsesResult.data,
  );
  const checkins = parseDigitalAthleteRows(DailyCheckinSourceSchema, checkinsResult.data);
  const bodyMetrics = parseDigitalAthleteRows(BodyMetricSourceSchema, bodyMetricsResult.data);
  const nutritionLogs = parseDigitalAthleteRows(NutritionLogSourceSchema, nutritionLogsResult.data);
  const decisionFeedback = parseDecisionFeedbackRows(decisionFeedbackResult.data);
  const setLogs = parseDigitalAthleteRows(MuscleLoadSetSourceSchema, setLogsResult.data);
  const exerciseMuscleGroups = parseDigitalAthleteRows(
    MuscleLoadExerciseSourceSchema,
    exerciseMuscleGroupsResult.data,
  );

  return buildDigitalAthleteState(
    {
      workouts: workouts.rows,
      workoutResponses: workoutResponses.rows,
      checkins: checkins.rows,
      bodyMetrics: bodyMetrics.rows,
      nutritionLogs: nutritionLogs.rows,
      decisionFeedback: decisionFeedback.rows,
      lifeContexts: lifeContextResult.contexts,
      trainingRhythm: trainingRhythmResult.trainingRhythm,
      setLogs: setLogs.rows,
      exerciseMuscleGroups: exerciseMuscleGroups.rows,
      availability: {
        training: workoutsResult.error === null && workouts.valid,
        // Training-response parsing is intentionally isolated from the
        // completed-workout source: malformed historical ratings never erase
        // valid training evidence or block a Today decision.
        trainingResponse: workoutResponsesResult.error === null && workoutResponses.valid,
        recovery: checkinsResult.error === null && checkins.valid,
        body: bodyMetricsResult.error === null && bodyMetrics.valid,
        nutrition: nutritionLogsResult.error === null && nutritionLogs.valid,
        decisionFeedback: decisionFeedbackResult.error === null && decisionFeedback.valid,
        muscleLoad:
          setLogsResult.error === null &&
          setLogs.valid &&
          exerciseMuscleGroupsResult.error === null &&
          exerciseMuscleGroups.valid,
        context: lifeContextResult.available,
        trainingRhythm: trainingRhythmResult.available,
      },
    },
    now,
    zone,
  );
}
