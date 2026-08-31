import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
    recoveryScore?: number;
    restingHr?: number;
    hrvMs?: number;
    sleepHours?: number;
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
  memory: Array<{
    type: string;
    content: string;
    confidence: number;
    importance: number;
    lastConfirmedAt: string | null;
  }>;
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
    supabase
      .from("profiles")
      .select("goal")
      .eq("id", userId)
      .maybeSingle(),
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

  return {
    userId,
    todayNutrition: {
      ...nutrition,
      targetCalories,
      targetProteinG,
      remainingCalories: Math.max(0, targetCalories - nutrition.calories),
      remainingProteinG: Math.max(0, targetProteinG - nutrition.proteinG),
    },
    recentWorkout,
    healthBiomarkers: health
      ? {
          recoveryScore: health.recovery_score,
          restingHr: health.resting_hr,
          hrvMs: health.hrv_ms,
          sleepHours: health.sleep_hours,
          notes: health.sleep_quality != null ? `Sleep quality: ${health.sleep_quality}/5` : undefined,
        }
      : undefined,
    activeGoal: normalizeGoal(profile?.goal ?? null),
  };
}

export async function getUserBiometricContext(): Promise<UserBiometricContext | null> {
  try {
    const { user, supabase } = await requireSupabaseAuth();
    if (!user) return null;
    return await buildBiometricContext(supabase, user.id);
  } catch (err) {
    console.warn("Could not retrieve full biometric context:", err);
    return null;
  }
}

export async function buildUserContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CentralUserContext> {
  const [{ data: profile }, { data: memory }, biometric] = await Promise.all([
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
  ]);

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
  return JSON.stringify(context, null, 2);
}
