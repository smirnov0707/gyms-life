import { USER, MEAL_ID, TRAINING_ID, VERSION, profile, mealPlan, trainingPlan } from "./fixtures";
import { dayInTimeZone, browserTimeZone } from "../../src/lib/local-day";
import type { Supplement } from "../../src/lib/supplement.schema";
export type FoodRow = {
  id: string;
  user_id: string;
  logged_on: string;
  created_at: string;
  food_name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  note: string | null;
};
export type ReadinessRow = {
  id: string;
  user_id: string;
  checkin_on: string;
  readiness_score: number | null;
  load_modifier: number | null;
  advice: string | null;
};
export type MealRow = {
  id: string;
  user_id: string;
  data: typeof mealPlan;
  lang: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  kcal_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
};
const scenario = new URLSearchParams(location.search).get("scenario") ?? "ready";
export const state: {
  profile: typeof profile;
  meal: MealRow | null;
  foods: FoodRow[];
  supplements: Supplement[];
  checkin: ReadinessRow | null;
  active: boolean;
  plan: typeof trainingPlan;
  fail: string | null;
  counts: Record<string, number>;
  last: Record<string, unknown>;
  workoutSession: {
    started: boolean;
    finished: boolean;
    logs: {
      exercise_slug: string;
      set_number: number;
      done: boolean;
      weight_kg: number | null;
      reps: number | null;
    }[];
  };
} = {
  profile: structuredClone(profile),
  supplements:
    scenario === "empty"
      ? []
      : [
          {
            id: "88888888-8888-4888-8888-888888888881",
            name: "Synthetic morning product",
            dose: "Label amount",
            category: "general",
            times_per_day: 1,
            with_food: true,
            preferred_time: "morning",
            notes: "Synthetic saved label note.",
            is_active: true,
          },
          {
            id: "88888888-8888-4888-8888-888888888882",
            name: "Synthetic evening product",
            dose: null,
            category: "general",
            times_per_day: 1,
            with_food: false,
            preferred_time: "evening",
            notes: null,
            is_active: true,
          },
          {
            id: "88888888-8888-4888-8888-888888888883",
            name: "Synthetic paused product",
            dose: null,
            category: "general",
            times_per_day: 1,
            with_food: false,
            preferred_time: "any",
            notes: null,
            is_active: false,
          },
        ],
  checkin:
    scenario === "empty"
      ? null
      : {
          id: "66666666-6666-4666-8666-666666666666",
          user_id: USER,
          checkin_on: dayInTimeZone(new Date(), browserTimeZone()),
          readiness_score: scenario === "missing-readiness" ? null : 72,
          load_modifier: scenario === "missing-readiness" ? null : 1,
          advice: "Synthetic saved check-in advice.",
        },
  meal:
    scenario === "empty"
      ? null
      : {
          id: MEAL_ID,
          user_id: USER,
          data: structuredClone(mealPlan),
          lang: "en",
          created_at: VERSION,
          updated_at: VERSION,
          is_active: true,
          kcal_target: 2000,
          protein_target: 100,
          carbs_target: 240,
          fat_target: 72,
        },
  foods:
    scenario === "empty"
      ? []
      : [
          {
            id: "44444444-4444-4444-8444-444444444444",
            user_id: USER,
            logged_on: dayInTimeZone(new Date(), browserTimeZone()),
            created_at: VERSION,
            food_name: "Synthetic breakfast",
            description: "Synthetic breakfast",
            calories: 500,
            protein: 25,
            carbs: 60,
            fat: 18,
            source: "text_estimate",
            note: null,
          },
        ],
  active: scenario !== "empty",
  plan: structuredClone(trainingPlan),
  fail: new URLSearchParams(location.search).get("fail"),
  counts: {},
  last: {},
  workoutSession: { started: false, finished: false, logs: [] },
};
if (scenario === "recipe-conflict" && state.meal)
  state.meal.data.days[0]!.meals[0]!.ingredients.push("Peanut butter 20 g");
if (scenario === "workout-gap") {
  const slug = state.plan.days[0]!.exercises[0]!.slug;
  state.workoutSession = {
    started: true,
    finished: false,
    logs: [1, 3, 4].map((set_number) => ({
      exercise_slug: slug,
      set_number,
      done: true,
      weight_kg: 20,
      reps: 8,
    })),
  };
}
const stored = sessionStorage.getItem("gyms-core-fixture");
if (stored) {
  const parsed = JSON.parse(stored);
  Object.assign(state, parsed);
  state.fail = new URLSearchParams(location.search).get("fail");
}
export const persist = () => sessionStorage.setItem("gyms-core-fixture", JSON.stringify(state));
export const count = (key: string) => {
  state.counts[key] = (state.counts[key] ?? 0) + 1;
};
export const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 350));
export const ids = { USER, MEAL_ID, TRAINING_ID, VERSION };
Object.assign(window, { __core: state });
