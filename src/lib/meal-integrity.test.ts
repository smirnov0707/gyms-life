import { assertKnownRecipeRestrictions } from "./meal-restrictions.validation";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseIngredientQuantity } from "./ingredient-quantity";
import { buildShoppingList } from "./shopping-build";
import { assertMealRecipeIntegrity, assertMealTargetIntegrity } from "./meal-recipe.integrity";
import { findKnownRecipeConflicts } from "./meal-restrictions.engine";
import { RecipeGenerationSchema, recipePartSchema } from "./meal-generation.contract";
import {
  assertTranslationStrings,
  assertMealTranslationStructure,
} from "./meal-translation.integrity";
import { collectMealStrings, applyMealStrings } from "./meal-i18n.server";
import { commitGeneratedMealPlan } from "./meal-commit.service";
import { MealPreferencesSchema } from "./meal-preferences.schema";
import { mealPlan, MEAL_ID, VERSION } from "../../tests/core-browser/fixtures";
const first = mealPlan.days[0]!;
const dayWith = (ingredients: string[]) => [
  { ...first, meals: [{ ...first.meals[0]!, ingredients }] },
];
describe("unambiguous ingredient quantities", () => {
  it.each([
    ["150 g oats", 150, "g", "oats"],
    ["Oats 150 g", 150, "g", "Oats"],
    ["Rice (dry) 0,5 kg", 0.5, "kg", "Rice (dry)"],
    ["1/2 cup oats", 0.5, "cup", "oats"],
    ["Oats ½ cup", 0.5, "cup", "Oats"],
    ["1 1/2 cups oats", 1.5, "cup", "oats"],
    ["Eggs 2 pcs", 2, "pcs", "Eggs"],
    ["2 eggs", 2, "pcs", "eggs"],
    ["2 vnt. kiaušinių", 2, "pcs", "kiaušinių"],
    ["Yogurt 2% 200 g", 200, "g", "Yogurt 2%"],
    ["1 tsp cinnamon", 1, "tsp", "cinnamon"],
    ["½ avocado", 0.5, "pcs", "avocado"],
  ])("parses %s without changing its meaning", (input, qty, unit, name) =>
    expect(parseIngredientQuantity(String(input))).toEqual({ qty, unit, name }),
  );
  it.each([
    "Rice 100–150 g",
    "-5 g rice",
    "1/0 cup oats",
    "Oats 0 g",
    "1 scoop powder",
    "2 oz cheese",
    "rice",
    "milk 2%",
  ])("keeps %s unquantified rather than guessing", (input) =>
    expect(parseIngredientQuantity(input).qty).toBeNull(),
  );
  it("does not mix dry/cooked rice or call unspecified main ingredients 'to taste'", () => {
    const p = {
      ...mealPlan,
      days: dayWith(["Rice (dry) 100 g", "Rice (cooked) 100 g", "Chicken"]),
    };
    const items = buildShoppingList(p, "en").flatMap((group) => group.items);
    expect(items).toContainEqual({ name: "Rice (dry)", amount: "100 g" });
    expect(items).toContainEqual({ name: "Rice (cooked)", amount: "100 g" });
    expect(items.find((item) => item.name === "Chicken")?.amount).toContain("unspecified");
  });
});
describe("recipe versus displayed nutrition consistency", () => {
  it("does not let opposite meal errors cancel out in the daily total", () => {
    const days = structuredClone(mealPlan.days);
    days[0]!.meals[0]!.kcal = 900;
    days[0]!.meals[1]!.kcal = 100;
    expect(days[0]!.meals.reduce((total, meal) => total + meal.kcal, 0)).toBe(2000);
    expect(() => assertMealRecipeIntegrity(days)).toThrow(/meal's calories/);
  });
  it("requires usable quantities on new generated recipes", () => {
    expect(() => assertMealRecipeIntegrity(dayWith(["Oats"]), true)).toThrow(/amount/);
    expect(() =>
      assertMealRecipeIntegrity(dayWith(["Oats 100 g", "salt to taste"]), true),
    ).not.toThrow();
  });
  it("checks header target arithmetic separately", () =>
    expect(() => assertMealTargetIntegrity({ ...mealPlan, protein_target: 900 })).toThrow(
      /target calories/,
    ));
  it.each([null, true, false, ""])(
    "does not convert missing macro %j into a plausible zero",
    (value) =>
      expect(RecipeGenerationSchema.safeParse({ ...first.meals[0], protein: value }).success).toBe(
        false,
      ),
  );
  it("validates the assigned partial days before using another provider call", () => {
    expect(recipePartSchema([1, 2, 3, 4]).safeParse(mealPlan.days.slice(0, 4)).success).toBe(true);
    expect(recipePartSchema([1, 2, 3, 4]).safeParse([first, first, first, first]).success).toBe(
      false,
    );
  });
});
describe("known positive text conflicts, not safety certification", () => {
  it.each([
    ["vegan", "", ["Chicken 150 g"]],
    ["vegetarian", "", ["Tuna 150 g"]],
    ["vegan", "", ["Honey 10 g"]],
    ["any", "milk", ["Lactose-free milk 200 ml"]],
    ["any", "pienui", ["Išrūgų baltymai 30 g"]],
    ["any", "peanuts", ["Peanut butter 20 g"]],
    ["any", "žemės riešutams", ["Žemės riešutų sviestas 20 g"]],
    ["any", "sesame", ["Tahini 20 g"]],
    ["any", "soy", ["Tofu 150 g"]],
    ["gluten free", "", ["Wheat pasta 100 g"]],
    ["any", "eggs", ["Kiaušiniai 2 pcs"]],
  ])("rejects a recognized recipe conflict with %s / %s", (diet, allergies, ingredients) =>
    expect(() =>
      assertKnownRecipeRestrictions(dayWith(ingredients as string[]), {
        diet: String(diet),
        allergies: String(allergies),
      }),
    ).toThrow("MEAL_RESTRICTION_CONFLICT"),
  );
  it.each([
    ["vegan", "milk", ["Oat milk 200 ml", "Peanut butter 20 g"]],
    ["any", "eggs", ["Eggplant 150 g"]],
    ["any", "nuts", ["Nutmeg 1 g", "Butternut squash 100 g"]],
    ["vegan", "", ["Avižų pienas 200 ml", "Žemės riešutų sviestas 20 g"]],
    ["gluten free", "", ["Certified gluten-free oats 100 g"]],
  ])("avoids known text false positives for %s / %s", (diet, allergies, ingredients) =>
    expect(
      findKnownRecipeConflicts(dayWith(ingredients as string[]), {
        diet: String(diet),
        allergies: String(allergies),
      }),
    ).toEqual([]),
  );
  it("plant milk does not hide a second dairy ingredient", () =>
    expect(
      findKnownRecipeConflicts(dayWith(["Oat milk with whey 200 ml"]), {
        diet: "vegan",
        allergies: "milk",
      }).length,
    ).toBeGreaterThan(0));
});
describe("meal translation integrity", () => {
  it("retains all numerical recipe facts for valid wording changes", () => {
    const input = collectMealStrings(mealPlan);
    const result = applyMealStrings(
      mealPlan,
      input.map((text) => text.replace("Synthetic", "Test")),
    );
    expect(() => assertMealTranslationStructure(mealPlan, result)).not.toThrow();
    expect(result.days[0]!.meals[0]!.kcal).toBe(500);
  });
  it.each([
    ["Oats 100 g", "Avižos 200 g"],
    ["Cook for 10 minutes", "Virk 20 minučių"],
    ["", "Invented text"],
  ])("rejects changed numeric/empty string %s", (a, b) =>
    expect(() => assertTranslationStrings([a], [b])).toThrow(),
  );
  it("does not silently fill a missing translation chunk with originals", () =>
    expect(() => applyMealStrings(mealPlan, collectMealStrings(mealPlan).slice(1))).toThrow(
      /INCOMPLETE/,
    ));
  it("rejects changed units even when the digits are equal", () => {
    const translated = structuredClone(mealPlan);
    translated.days[0]!.meals[0]!.ingredients[0] = "Oats 100 kg";
    expect(() => assertMealTranslationStructure(mealPlan, translated)).toThrow(/QUANTITY/);
  });
  it("rejects numeric or day-order changes in old cached translations", () => {
    const translated = structuredClone(mealPlan);
    translated.days[0]!.meals[0]!.protein = 999;
    expect(() => assertMealTranslationStructure(mealPlan, translated)).toThrow(/STRUCTURE/);
  });
});
describe("atomic meal-save result contract", () => {
  const input = {
    planId: MEAL_ID,
    profileUpdatedAt: VERSION,
    plan: mealPlan,
    preferences: MealPreferencesSchema.parse({}),
    lang: "en" as const,
  };
  const db = (data: unknown, error: unknown = null) => {
    const rpc = vi.fn().mockResolvedValue({ data, error });
    return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
  };
  it("uses one RPC and its real returned timestamps", async () => {
    const d = db([{ plan_id: MEAL_ID, created_at: VERSION, updated_at: VERSION }]);
    expect(await commitGeneratedMealPlan(d.client, input)).toEqual({
      id: MEAL_ID,
      createdAt: VERSION,
      updatedAt: VERSION,
    });
    expect(d.rpc).toHaveBeenCalledTimes(1);
    expect(d.rpc.mock.calls[0]![0]).toBe("commit_generated_meal_plan");
  });
  it.each([
    null,
    [],
    [{ plan_id: "different" }],
    [{ plan_id: MEAL_ID, created_at: VERSION, updated_at: "invalid" }],
  ])("never says success for invalid save confirmation %j", async (data) => {
    const d = db(data);
    await expect(commitGeneratedMealPlan(d.client, input)).rejects.toThrow();
  });
  it("preserves a profile-change conflict without raw provider data", async () => {
    const d = db(null, { message: "MEAL_PROFILE_CHANGED" });
    await expect(commitGeneratedMealPlan(d.client, input)).rejects.toThrow("MEAL_PROFILE_CHANGED");
  });
});
