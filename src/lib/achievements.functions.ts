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

function calculateWorkoutStreak(workoutDates: string[]): number {
  const dates = new Set(workoutDates.map((date) => date.slice(0, 10)));
  const cursor = new Date();
  let streak = 0;

  while (true) {
    const today = cursor.toISOString().slice(0, 10);
    if (!dates.has(today)) {
      if (streak === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (!dates.has(cursor.toISOString().slice(0, 10))) return 0;
        continue;
      }
      return streak;
    }
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}

export const getUserAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: workouts, error: workoutsError }, { data: meals, error: mealsError }] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("started_at, total_volume")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false }),
      supabase.from("vision_meal_scans").select("id").eq("user_id", userId),
    ]);
    if (workoutsError || mealsError) throw new Error("Could not load achievement progress.");

    const completedWorkouts = workouts ?? [];
    const streak = calculateWorkoutStreak(completedWorkouts.map((workout) => workout.started_at));
    const totalWorkouts = completedWorkouts.length;
    const totalVolume = completedWorkouts.reduce((total, workout) => total + Number(workout.total_volume), 0);
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
