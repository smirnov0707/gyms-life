import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "streak" | "volume" | "mastery" | "nutrition";
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

function calculateStreak(dates: string[]): number {
  const uniqueDates = new Set(dates.map((value) => value.slice(0, 10)));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const date = cursor.toISOString().slice(0, 10);
    if (!uniqueDates.has(date)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const getUserAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: workouts }, { data: meals }] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("total_volume, finished_at")
        .eq("user_id", userId)
        .not("finished_at", "is", null),
      supabase.from("nutrition_logs").select("id").eq("user_id", userId),
    ]);

    const workoutRows = workouts ?? [];
    const streak = calculateStreak(workoutRows.map((workout) => workout.finished_at ?? ""));
    const totalWorkouts = workoutRows.length;
    const totalVolume = workoutRows.reduce((acc, workout) => acc + Number(workout.total_volume ?? 0), 0);
    const totalMeals = (meals ?? []).length;

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
        description: "Užregistruota 30 valgių",
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
