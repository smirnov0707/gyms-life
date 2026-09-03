import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateConsecutiveCalendarDayStreak } from "./local-day";
import { resolvePersistedProfileTimeZone } from "./user-context.server";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "streak" | "volume" | "mastery" | "nutrition";
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

export const getUserAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [workoutsResult, mealsResult, profileResult] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("started_at, total_volume")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false }),
      supabase.from("vision_meal_scans").select("id").eq("user_id", userId),
      supabase.from("profiles").select("time_zone").eq("id", userId).maybeSingle(),
    ]);
    if (workoutsResult.error || mealsResult.error || profileResult.error) {
      throw new Error("Could not load achievement progress.");
    }

    const completedWorkouts = workoutsResult.data ?? [];
    const timeZone = resolvePersistedProfileTimeZone(profileResult.data?.time_zone);
    const streak = calculateConsecutiveCalendarDayStreak(
      completedWorkouts.map((workout) => workout.started_at),
      timeZone,
    );
    const totalWorkouts = completedWorkouts.length;
    const totalVolume = completedWorkouts.reduce(
      (total, workout) => total + Number(workout.total_volume),
      0,
    );
    const totalMeals = (mealsResult.data ?? []).length;

    const achievements: Achievement[] = [
      {
        id: "first-session",
        title: "Pirmasis Žingsnis",
        description: "Užregistruota pirmoji treniruotė",
        category: "mastery",
        unlocked: totalWorkouts >= 1,
        progress: Math.min(totalWorkouts, 1),
        maxProgress: 1,
      },
      {
        id: "streak-7",
        title: "Geležinė Drausmė",
        description: "7 dienų aktyvumo serija be pertraukų",
        category: "streak",
        unlocked: streak >= 7,
        progress: Math.min(streak, 7),
        maxProgress: 7,
      },
      {
        id: "volume-10t",
        title: "10 Tonų Klubas",
        description: "Bendrai pakelta 10 000 kg tūrio",
        category: "volume",
        unlocked: totalVolume >= 10000,
        progress: Math.min(totalVolume, 10000),
        maxProgress: 10000,
      },
      {
        id: "nutrition-pro",
        title: "Mitybos Meistras",
        description: "Užregistruota 30 valgių per Vision skenerį",
        category: "nutrition",
        unlocked: totalMeals >= 30,
        progress: Math.min(totalMeals, 30),
        maxProgress: 30,
      },
    ];

    return {
      achievements,
      stats: {
        streak,
        totalWorkouts,
        totalVolumeKg: Math.round(totalVolume),
      },
    };
  });
