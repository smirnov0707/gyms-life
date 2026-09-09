import { USER, MEAL_ID, TRAINING_ID, VERSION, profile, mealPlan, trainingPlan } from "./fixtures";
import { dayInTimeZone, browserTimeZone } from "../../src/lib/local-day";
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
  active: boolean;
  plan: typeof trainingPlan;
  fail: string | null;
  counts: Record<string, number>;
  last: Record<string, unknown>;
} = {
  profile: structuredClone(profile),
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
};
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
