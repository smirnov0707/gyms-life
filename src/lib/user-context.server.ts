import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

/** Central GYMS.LIFE user context. AI providers never query Supabase directly. */

export async function buildUserContext(supabase: Db, userId: string) {
  const [
    profile,
    plan,
    workouts,
    nutrition,
    checkins,
    body,
    coach,
    memory,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),

    supabase
      .from("plans")
      .select("id, data, goal, is_active, created_at, updated_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("workout_sessions")
      .select(
        "id, title, started_at, finished_at, total_volume, duration_seconds",
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(12),

    supabase
      .from("nutrition_logs")
      .select(
        "id, logged_on, calories, protein, carbs, fat, food_name",
      )
      .eq("user_id", userId)
      .order("logged_on", { ascending: false })
      .limit(14),

    supabase
      .from("daily_checkins")
      .select(
        "checkin_on, sleep_hours, sleep_quality, soreness, stress, energy, mood, readiness_score, load_modifier",
      )
      .eq("user_id", userId)
      .order("checkin_on", { ascending: false })
      .limit(14),

    supabase
      .from("body_metrics")
      .select(
        "measured_on, weight_kg, body_fat, waist_cm, chest_cm, arm_cm",
      )
      .eq("user_id", userId)
      .order("measured_on", { ascending: false })
      .limit(12),

    supabase
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),

    supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("importance", { ascending: false })
      .limit(30),
  ]);

  return {
    userId,
    profile: profile.data ?? null,
    activePlan: plan.data ?? null,
    recentWorkouts: workouts.data ?? [],
    recentNutrition: nutrition.data ?? [],
    recentCheckins: checkins.data ?? [],
    recentBodyMetrics: body.data ?? [],
    recentCoachMemory: coach.data ?? [],
    userMemory: memory.data ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export function contextForAi(
  context: Awaited<ReturnType<typeof buildUserContext>>,
) {
  return JSON.stringify(context);
}
