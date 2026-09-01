import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface UserBiometricContext {
  userId: string;
  todayNutrition: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    targetCalories: number;
    targetProteinG: number;
    remainingCalories: number;
    remainingProteinG: number;
  };
  recentWorkout?: {
    date: string;
    focus: string;
    totalSets: number;
    avgRpe: number;
    fatigueLevel: "low" | "medium" | "high";
  };
  healthBiomarkers?: {
    recoveryScore?: number | null;
    restingHr?: number | null;
    hrvMs?: number | null;
    sleepHours?: number | null;
    notes?: string;
  };
  activeGoal: "muscle_gain" | "fat_loss" | "recomp" | "strength";
}

export interface CentralUserContext {
  profile: {
    displayName: string | null;
    locale: string;
    goal: string | null;
    experience: string | null;
    heightCm: number | null;
    weightKg: number | null;
    targetWeightKg: number | null;
    daysPerWeek: number | null;
    sessionMinutes: number | null;
    equipment: string[];
    limitations: string | null;
    diet: string | null;
    allergies: string | null;
    dislikes: string | null;
    mealsPerDay: number | null;
  };
  biometric: UserBiometricContext;
  aiPersonalization: AiPersonalizationConsent;
  aiSummary: AiPersonalizationSummary;
  memory: Array<{
    type: string;
    content: string;
    confidence: number;
    importance: number;
    lastConfirmedAt: string | null;
  }>;
}

export interface AiPersonalizationConsent {
  enabled: boolean;
  policyVersion: string | null;
  lastRecordedAt: string | null;
}

export interface AiPersonalizationSummary {
  training: {
    sessionsLast7Days: number;
    sessionsLast28Days: number;
    totalVolumeLast28Days: number;
    daysSinceLastCompletedWorkout: number | null;
  };
  recovery: {
    latestReadinessScore: number | null;
    averageReadinessLast7Days: number | null;
    averageSleepHoursLast7Days: number | null;
  };
  body: {
    latestWeightKg: number | null;
    latestBodyFatPercent: number | null;
    weightChangeKgLast30Days: number | null;
  };
  dataGaps: string[];
}

export interface AiPersonalizationSources {
  workouts: Array<{ started_at: string; total_volume: number }>;
  checkins: Array<{
    checkin_on: string;
    readiness_score: number | null;
    sleep_hours: number | null;
  }>;
  bodyMetrics: Array<{
    measured_on: string;
    weight_kg: number | null;
    body_fat: number | null;
  }>;
  availability: {
    training: boolean;
    recovery: boolean;
    body: boolean;
  };
}

const DAY_MS = 86_400_000;

function emptyAiPersonalizationSummary(dataGap: string): AiPersonalizationSummary {
  return {
    training: {
      sessionsLast7Days: 0,
      sessionsLast28Days: 0,
      totalVolumeLast28Days: 0,
      daysSinceLastCompletedWorkout: null,
    },
    recovery: {
      latestReadinessScore: null,
      averageReadinessLast7Days: null,
      averageSleepHoursLast7Days: null,
    },
    body: {
      latestWeightKg: null,
      latestBodyFatPercent: null,
      weightChangeKgLast30Days: null,
    },
    dataGaps: [dataGap],
  };
}

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

/**
 * Converts authenticated database rows into a small, date-free trend summary.
 * This is the only recovery/training/body-history data allowed past the AI boundary.
 */
export function buildAiPersonalizationSummary(
  sources: AiPersonalizationSources,
  now = new Date(),
): AiPersonalizationSummary {
  const completedWorkouts = sources.workouts.filter((workout) =>
    isWithinPastDays(workout.started_at, 365, now),
  );
  const workoutsLast7Days = completedWorkouts.filter((workout) =>
    isWithinPastDays(workout.started_at, 7, now),
  );
  const workoutsLast28Days = completedWorkouts.filter((workout) =>
    isWithinPastDays(workout.started_at, 28, now),
  );
  const checkinsLast7Days = sources.checkins.filter((checkin) =>
    isWithinPastDays(checkin.checkin_on, 7, now),
  );
  const bodyMetricsLast30Days = sources.bodyMetrics.filter((metric) =>
    isWithinPastDays(metric.measured_on, 30, now),
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
  const dataGaps: string[] = [];

  if (!sources.availability.training) dataGaps.push("training_data_unavailable");
  else if (workoutsLast28Days.length === 0) dataGaps.push("no_completed_workouts_28d");
  if (!sources.availability.recovery) dataGaps.push("recovery_data_unavailable");
  else if (checkinsLast7Days.length === 0) dataGaps.push("no_recovery_checkins_7d");
  if (!sources.availability.body) dataGaps.push("body_measurements_unavailable");
  else if (bodyMetricsLast30Days.length === 0) dataGaps.push("no_body_measurements_30d");

  return {
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
    dataGaps,
  };
}

function normalizeGoal(goal: string | null): UserBiometricContext["activeGoal"] {
  if (goal === "fat_loss" || goal === "recomp" || goal === "strength") return goal;
  return "muscle_gain";
}

async function buildBiometricContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserBiometricContext> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: nutritionLogs }, { data: activePlan }] = await Promise.all([
    supabase.from("profiles").select("goal").eq("id", userId).maybeSingle(),
    supabase
      .from("nutrition_logs")
      .select("calories, protein, carbs, fat")
      .eq("user_id", userId)
      .eq("logged_on", today),
    supabase
      .from("meal_plans")
      .select("kcal_target, protein_target")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nutrition = (nutritionLogs ?? []).reduce(
    (sum, item) => ({
      calories: sum.calories + Number(item.calories ?? 0),
      proteinG: sum.proteinG + Number(item.protein ?? 0),
      carbsG: sum.carbsG + Number(item.carbs ?? 0),
      fatG: sum.fatG + Number(item.fat ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const targetCalories = Number(activePlan?.kcal_target ?? 2500);
  const targetProteinG = Number(activePlan?.protein_target ?? 170);

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, title, started_at, created_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let recentWorkout: UserBiometricContext["recentWorkout"];
  if (session) {
    const { data: sets } = await supabase
      .from("set_logs")
      .select("rpe, done")
      .eq("user_id", userId)
      .eq("session_id", session.id);

    const completedSets = (sets ?? []).filter((set) => set.done);
    const rpes = completedSets.map((set) => Number(set.rpe)).filter(Number.isFinite);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 7;

    recentWorkout = {
      date: session.started_at ?? session.created_at,
      focus: session.title || "Pilno kūno treniruotė",
      totalSets: completedSets.length,
      avgRpe,
      fatigueLevel: avgRpe > 8.5 ? "high" : avgRpe > 7 ? "medium" : "low",
    };
  }

  const { data: health } = await supabase
    .from("health_samples")
    .select("recovery_score, resting_hr, hrv_ms, sleep_hours, sleep_quality")
    .eq("user_id", userId)
    .order("sample_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const healthBiomarkers = health
    ? {
        recoveryScore: health.recovery_score,
        restingHr: health.resting_hr,
        hrvMs: health.hrv_ms,
        sleepHours: health.sleep_hours,
        ...(health.sleep_quality != null
          ? { notes: `Sleep quality: ${health.sleep_quality}/5` }
          : {}),
      }
    : undefined;

  return {
    userId,
    todayNutrition: {
      ...nutrition,
      targetCalories,
      targetProteinG,
      remainingCalories: Math.max(0, targetCalories - nutrition.calories),
      remainingProteinG: Math.max(0, targetProteinG - nutrition.proteinG),
    },
    ...(recentWorkout ? { recentWorkout } : {}),
    ...(healthBiomarkers ? { healthBiomarkers } : {}),
    activeGoal: normalizeGoal(profile?.goal ?? null),
  };
}

export async function getUserBiometricContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserBiometricContext> {
  return buildBiometricContext(supabase, userId);
}

export function calculateWorkoutStreak(workoutDates: string[]): number {
  const activeDates = new Set(workoutDates.map((date) => date.slice(0, 10)));
  const cursor = new Date();
  let streak = 0;

  while (true) {
    const date = cursor.toISOString().slice(0, 10);
    if (!activeDates.has(date)) {
      if (streak === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (!activeDates.has(cursor.toISOString().slice(0, 10))) return 0;
        continue;
      }
      return streak;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}

export async function buildUserContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CentralUserContext> {
  const [{ data: profile }, { data: memory }, biometric, consentResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, locale, goal, experience, height_cm, weight_kg, target_weight_kg, days_per_week, session_minutes, equipment, limitations, diet, allergies, dislikes, meals_per_day",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_memory")
      .select("memory_type, content, confidence, importance, last_confirmed_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("importance", { ascending: false })
      .order("last_confirmed_at", { ascending: false })
      .limit(30),
    buildBiometricContext(supabase, userId),
    supabase
      .from("ai_personalization_consents")
      .select("granted, policy_version, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const aiPersonalization = {
    enabled: consentResult.error === null && consentResult.data?.granted === true,
    policyVersion: consentResult.data?.policy_version ?? null,
    lastRecordedAt: consentResult.data?.recorded_at ?? null,
  };
  let aiSummary = emptyAiPersonalizationSummary(
    consentResult.error
      ? "personalization_consent_unavailable"
      : "personalization_consent_required",
  );

  if (aiPersonalization.enabled) {
    const metricsSince = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
    const [workoutsResult, checkinsResult, bodyMetricsResult] = await Promise.all([
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
        .gte("measured_on", metricsSince)
        .order("measured_on", { ascending: false })
        .limit(60),
    ]);

    aiSummary = buildAiPersonalizationSummary({
      workouts: workoutsResult.data ?? [],
      checkins: checkinsResult.data ?? [],
      bodyMetrics: bodyMetricsResult.data ?? [],
      availability: {
        training: workoutsResult.error === null,
        recovery: checkinsResult.error === null,
        body: bodyMetricsResult.error === null,
      },
    });
  }

  return {
    profile: {
      displayName: profile?.display_name ?? null,
      locale: profile?.locale ?? "lt",
      goal: profile?.goal ?? null,
      experience: profile?.experience ?? null,
      heightCm: profile?.height_cm ?? null,
      weightKg: profile?.weight_kg ?? null,
      targetWeightKg: profile?.target_weight_kg ?? null,
      daysPerWeek: profile?.days_per_week ?? null,
      sessionMinutes: profile?.session_minutes ?? null,
      equipment: profile?.equipment ?? [],
      limitations: profile?.limitations ?? null,
      diet: profile?.diet ?? null,
      allergies: profile?.allergies ?? null,
      dislikes: profile?.dislikes ?? null,
      mealsPerDay: profile?.meals_per_day ?? null,
    },
    biometric,
    aiPersonalization,
    aiSummary,
    memory: (memory ?? []).map((item) => ({
      type: item.memory_type,
      content: item.content,
      confidence: Number(item.confidence ?? 0),
      importance: Number(item.importance ?? 0),
      lastConfirmedAt: item.last_confirmed_at,
    })),
  };
}

export function contextForAi(context: CentralUserContext): string {
  const baseContext = {
    schemaVersion: "1.0",
    preferences: {
      locale: context.profile.locale,
      goal: context.profile.goal,
      experience: context.profile.experience,
      trainingDaysPerWeek: context.profile.daysPerWeek,
      sessionMinutes: context.profile.sessionMinutes,
      equipment: context.profile.equipment,
    },
    personalization: {
      enabled: context.aiPersonalization.enabled,
      policyVersion: context.aiPersonalization.policyVersion,
    },
  };

  const externalContext = context.aiPersonalization.enabled
    ? {
        ...baseContext,
        nutritionToday: context.biometric.todayNutrition,
        recentSession: context.biometric.recentWorkout
          ? {
              totalSets: context.biometric.recentWorkout.totalSets,
              averageRpe: roundToOneDecimal(context.biometric.recentWorkout.avgRpe),
              fatigueLevel: context.biometric.recentWorkout.fatigueLevel,
            }
          : null,
        trainingHistory: context.aiSummary.training,
        recovery: context.aiSummary.recovery,
        bodyTrend: context.aiSummary.body,
        dataGaps: context.aiSummary.dataGaps,
      }
    : {
        ...baseContext,
        dataGaps: context.aiSummary.dataGaps,
      };

  return JSON.stringify(externalContext, null, 2);
}
