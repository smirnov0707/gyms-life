export type MealItem = {
  slot: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  minutes: number;
  ingredients: string[];
  steps: string[];
  tip: string;
};

export type MealDay = {
  day: number;
  title: string;
  total_kcal: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: MealItem[];
};

export type ShoppingItem = {
  name: string;
  amount: string;
};

export type ShoppingGroup = {
  category: string;
  items: ShoppingItem[];
};

export type GeneratedMealPlan = {
  title: string;
  summary: string;
  kcal_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  hydration: string;
  prep_tips: string[];
  days: MealDay[];
  shopping_list: ShoppingGroup[];
  adapted_at?: string;
  adapted_from_day?: number;
  adaptation_note?: string;
};
