// Synthetic records only. This directory never connects to a real account.
import type { GeneratedMealPlan } from "../../src/lib/meal-plan.schema";
import type { TrainingPlanData } from "../../src/lib/training-plan.schema";
export const USER = "11111111-1111-4111-8111-111111111111";
export const TRAINING_ID = "22222222-2222-4222-8222-222222222222";
export const MEAL_ID = "33333333-3333-4333-8333-333333333333";
export const VERSION = "2026-09-09T12:00:00.000Z";
export const mealPlan: GeneratedMealPlan = {
  title: "Synthetic seven-day meal plan",
  summary: "Explicit test fixture",
  kcal_target: 2000,
  protein_target: 100,
  carbs_target: 240,
  fat_target: 72,
  hydration: "Discuss an individual fluid target",
  prep_tips: ["Synthetic recipe example"],
  shopping_list: [],
  days: Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    title: `Synthetic day ${i + 1}`,
    total_kcal: 2000,
    total_protein: 100,
    total_carbs: 240,
    total_fat: 72,
    meals: Array.from({ length: 4 }, (_, j) => ({
      slot: `Meal ${j + 1}`,
      name: `Synthetic oats ${j + 1}`,
      kcal: 500,
      protein: 25,
      carbs: 60,
      fat: 18,
      minutes: 10,
      ingredients: ["Oats 100 g", "Soy milk 200 ml"],
      steps: ["Mix ingredients", "Serve"],
      tip: "Test only",
    })),
  })),
};
export const trainingPlan: TrainingPlanData = {
  title: "Synthetic training programme",
  summary: "Not a prescription",
  weeks: 8,
  progression: "Synthetic gradual progression",
  nutrition: "Use the separate nutrition plan",
  days: Array.from({ length: 3 }, (_, i) => ({
    day: i + 1,
    title: `Synthetic session ${i + 1}`,
    focus: "Full body",
    warmup: "Warmup",
    cooldown: "Cooldown",
    estimated_minutes: 45,
    exercises: ["push-up", "squat", "plank", "glute-bridge"].map((slug) => ({
      slug,
      name: slug,
      sets: 3,
      reps: "8-10",
      rest_seconds: 60,
      notes: "Synthetic test",
    })),
  })),
};
export const profile = {
  id: USER,
  display_name: "Synthetic Athlete",
  locale: "en",
  birth_year: 1990,
  gender: "female",
  height_cm: 170,
  weight_kg: 68,
  target_weight_kg: 65,
  experience: "intermediate",
  goal: "lose_fat",
  location: "home",
  days_per_week: 3,
  session_minutes: 45,
  equipment: ["bodyweight", "band"],
  limitations: "Existing synthetic restriction",
  onboarded: true,
  diet: "vegan",
  allergies: "peanuts",
  dislikes: "mushrooms",
  meals_per_day: 4,
};
