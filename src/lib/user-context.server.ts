import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    lowFerritin?: boolean;
    lowVitaminD?: boolean;
    highInflammation?: boolean;
    notes?: string;
  };
  activeGoal: "muscle_gain" | "fat_loss" | "recomp" | "strength";
}

export async function getUserBiometricContext(): Promise<UserBiometricContext | null> {
  try {
    const { user, supabase } = await requireSupabaseAuth();
    if (!user) return null;

    const today = new Date().toISOString().split("T")[0];

    // 1. Gauti šiandienos mitybos suvestinę
    const { data: nutritionLogs } = await supabase
      .from("nutrition_logs")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .eq("logged_on", today);

    let calories = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;

    (nutritionLogs || []).forEach((item: any) => {
      calories += Number(item.calories || 0);
      proteinG += Number(item.protein_g || 0);
      carbsG += Number(item.carbs_g || 0);
      fatG += Number(item.fat_g || 0);
    });

    const targetCalories = 2500;
    const targetProteinG = 170;

    // 2. Gauti paskutinės treniruotės duomenis
    const { data: recentWorkouts } = await supabase
      .from("workout_logs")
      .select("created_at, title, sets_completed, avg_rpe")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let recentWorkout;
    if (recentWorkouts && recentWorkouts.length > 0) {
      const w = recentWorkouts[0];
      const avgRpe = Number(w.avg_rpe || 7);
      recentWorkout = {
        date: w.created_at,
        focus: w.title || "Pilno kūno treniruotė",
        totalSets: Number(w.sets_completed || 12),
        avgRpe,
        fatigueLevel: avgRpe > 8.5 ? "high" : avgRpe > 7 ? "medium" : "low" as const,
      };
    }

    return {
      userId: user.id,
      todayNutrition: {
        calories,
        proteinG,
        carbsG,
        fatG,
        targetCalories,
        targetProteinG,
        remainingCalories: Math.max(0, targetCalories - calories),
        remainingProteinG: Math.max(0, targetProteinG - proteinG),
      },
      recentWorkout,
      activeGoal: "muscle_gain",
    };
  } catch (err) {
    console.warn("Could not retrieve full biometric context:", err);
    return null;
  }
}
