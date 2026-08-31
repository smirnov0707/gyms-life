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

export const getUserAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: workouts }, { data: meals }] = await Promise.all([
      supabase.from("profiles").select("streak_days").eq("id", userId).maybeSingle(),
      supabase.from("workout_logs").select("total_volume_kg, created_at").eq("user_id", userId),
      supabase.from("meal_logs").select("id").eq("user_id", userId),
    ]);

    const streak = profile?.streak_days || 1;
    const totalWorkouts = (workouts || []).length;
    const totalVolume = (workouts || []).reduce((acc, w) => acc + (Number(w.total_volume_kg) || 0), 0);
    const totalMeals = (meals || []).length;

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
