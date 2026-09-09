import { hasMealCalculationInputs } from "./meal-profile.guard";
import { validateGeneratedTrainingPlan } from "./training-plan-generation.validation";
import { canonicalizeGeneratedPlanExercises } from "./exercise-catalog.schema";
import { trainingPlan } from "../../tests/core-browser/fixtures";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { TrainingIntakeSchema, optionalFormNumber } from "./training-intake.schema";
import { MealPlanInputSchema, mealPreferencesFromProfile } from "./meal-preferences.schema";
import { refreshCoreData } from "./core-cache";
import { resolveNutritionTargets } from "./nutrition-targets.engine";
import { validateGeneratedMealPlan } from "./meal-plan-generation.validation";
import { validateAdaptationTargets } from "./meal-adaptation.validation";
import { mealPlan } from "../../tests/core-browser/fixtures";
const intake = {
  goal: "lose_fat",
  experience: "beginner",
  location: "home",
  equipment: ["bodyweight", "bands"],
  daysPerWeek: 3,
  sessionMinutes: 45,
  lang: "lt",
};
describe("core workflow contracts", () => {
  it("normalizes genuine equipment aliases without inventing body measurements", () => {
    const p = TrainingIntakeSchema.parse(intake);
    expect(p.equipment).toEqual(["bodyweight", "band"]);
    expect(p.age).toBeUndefined();
    expect(p.weightKg).toBeUndefined();
  });
  it.each([
    { daysPerWeek: 2.5 },
    { sessionMinutes: Infinity },
    { age: -1 },
    { heightCm: 0 },
    { weightKg: NaN },
    { goal: "injected task" },
    { equipment: ["unknown-machine"] },
  ])("rejects invalid intake before AI: %j", (bad) =>
    expect(() => TrainingIntakeSchema.parse({ ...intake, ...bad })).toThrow(),
  );
  it.each([
    ["", null],
    ["  ", null],
    ["75,5", 75.5],
    ["75.5", 75.5],
    ["0", 0],
  ])("parses a form number %s", (value, expected) =>
    expect(optionalFormNumber(String(value))).toBe(expected),
  );
  it.each(["7a", "8-10", "1,2,3", "Infinity", "-45"])(
    "does not turn invalid number %s into data",
    (value) => expect(optionalFormNumber(value)).toBeNaN(),
  );
  it("restores saved allergies and diet, without replacing them with default blanks", () => {
    expect(
      mealPreferencesFromProfile({
        diet: "vegan",
        allergies: "peanuts",
        dislikes: "mushrooms",
        meals_per_day: 3,
      }),
    ).toMatchObject({ diet: "vegan", allergies: "peanuts", dislikes: "mushrooms", mealsPerDay: 3 });
    expect(() => mealPreferencesFromProfile({ diet: "unknown" })).toThrow();
    expect(() => MealPlanInputSchema.parse({ kcalTarget: NaN })).toThrow();
  });
  it("maps current onboarding goals to the existing matching calculation, not the generic goal", () => {
    const input = {
      planKcal: null,
      planProteinG: null,
      planFatG: null,
      planCarbsG: null,
      bodyWeightKg: 80,
    };
    for (const [current, legacy] of [
      ["lose_fat", "lose"],
      ["build_muscle", "muscle"],
    ])
      expect(resolveNutritionTargets({ ...input, goal: current! })).toEqual(
        resolveNutritionTargets({ ...input, goal: legacy! }),
      );
  });
  it("refreshes affected read models after activation without evicting unrelated or offline state", async () => {
    const qc = new QueryClient();
    try {
      for (const key of [
        ["active-plan", "a"],
        ["todays-workout", "a"],
        ["future-lab-overview", "a"],
        ["meal-plan", "a"],
        ["offline-queue", "a"],
      ])
        qc.setQueryData(key, { value: "retained" });
      await refreshCoreData(qc, "training");
      for (const name of ["active-plan", "todays-workout", "future-lab-overview"])
        expect(qc.getQueryState([name, "a"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["offline-queue", "a"])?.isInvalidated).toBe(false);
      expect(qc.getQueryData(["offline-queue", "a"])).toEqual({ value: "retained" });
      await refreshCoreData(qc, "meals");
      expect(qc.getQueryState(["meal-plan", "a"])?.isInvalidated).toBe(true);
    } finally {
      qc.clear();
    }
  });
  it("uses the actual meal sums for accepted daily totals, without changing the input", () => {
    const input = structuredClone(mealPlan);
    input.days[0]!.total_kcal = 2100;
    input.days[0]!.total_protein = 105;
    const output = validateGeneratedMealPlan(input, { mealsPerDay: 4, fixedKcalTarget: 2000 });
    expect(output.days[0]!.total_kcal).toBe(2000);
    expect(output.days[0]!.total_protein).toBe(100);
    expect(input.days[0]!.total_kcal).toBe(2100);
  });
  it("rejects accepted-looking headers when actual meals miss the chosen energy target", () => {
    const p = structuredClone(mealPlan);
    p.days[0]!.meals.forEach((m) => (m.kcal = 435));
    expect(() => validateGeneratedMealPlan(p, { mealsPerDay: 4, fixedKcalTarget: 2000 })).toThrow(
      /Actual meals/,
    );
  });
  it("checks adaptation bounds in code rather than leaving a prompt to enforce them", () => {
    expect(() => validateAdaptationTargets(mealPlan, { ...mealPlan, kcal_target: 2600 })).toThrow(
      /15%/,
    );
    expect(() => validateAdaptationTargets(mealPlan, { ...mealPlan, protein_target: 160 })).toThrow(
      /15%/,
    );
    expect(() =>
      validateAdaptationTargets(mealPlan, { ...mealPlan, kcal_target: 2100 }),
    ).not.toThrow();
    const missing = structuredClone(mealPlan);
    missing.days[0]!.meals[0]!.kcal = 1;
    expect(() => validateAdaptationTargets(mealPlan, missing)).toThrow(/energy target/);
  });
  it("does not mount or retain fabricated TDEE and universal fasting components", () => {
    const page = readFileSync("src/routes/_authenticated/meal-plan.tsx", "utf8");
    for (const name of ["DynamicTDEECalculator", "SmartFastingWindow"]) {
      expect(page).not.toContain(name);
      expect(existsSync(`src/components/${name}.tsx`)).toBe(false);
    }
  });
  it("retains optimistic meal-write version and authenticated owner checks", () => {
    const source = readFileSync("src/lib/meal-adapt.functions.ts", "utf8");
    expect(source).toContain('.eq("user_id", userId)');
    expect(source).toContain('.eq("updated_at", row.updated_at)');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain("validateAdaptationTargets(activePlan, parsed)");
  });
});

describe("training generation request boundaries", () => {
  it("rejects a programme exceeding the stated session duration", () => {
    expect(() =>
      validateGeneratedTrainingPlan(
        trainingPlan,
        3,
        trainingPlan.days[0]!.exercises.map((e) => e.slug),
        30,
      ),
    ).toThrow(/duration/);
  });
  it("checks minimum rest time rather than trusting a short session label", () => {
    const plan = structuredClone(trainingPlan);
    for (const day of plan.days) {
      day.estimated_minutes = 15;
      day.exercises.forEach((e) => {
        e.sets = 10;
        e.rest_seconds = 120;
      });
    }
    expect(() =>
      validateGeneratedTrainingPlan(
        plan,
        3,
        plan.days[0]!.exercises.map((e) => e.slug),
        15,
      ),
    ).toThrow(/duration/);
  });
  it("does not resurrect an ambiguous catalog name when a third matching label appears", () => {
    const catalogue = ["first", "second", "third"].map((slug) => ({
      slug,
      name_en: "Ambiguous",
      name_lt: "Dviprasmis",
      muscle_group: "legs",
      equipment: "bodyweight",
      location: "home",
      difficulty: "beginner",
    }));
    const plan = structuredClone(trainingPlan);
    plan.days[0]!.exercises[0]!.slug = "Ambiguous";
    plan.days[0]!.exercises[0]!.name = "Ambiguous";
    expect(
      canonicalizeGeneratedPlanExercises(plan, catalogue, "en").days[0]!.exercises[0]!.slug,
    ).toBe("Ambiguous");
    plan.days[0]!.exercises[0]!.slug = "first";
    expect(
      canonicalizeGeneratedPlanExercises(plan, catalogue, "en").days[0]!.exercises[0]!.slug,
    ).toBe("first");
  });
});

describe("automatic meal target prerequisites", () => {
  const body = { age: 36, gender: "female", heightCm: 170, weightKg: 68 };
  it("accepts explicitly supplied inputs", () => expect(hasMealCalculationInputs(body)).toBe(true));
  it.each([
    { age: null },
    { gender: null },
    { gender: "other" },
    { heightCm: null },
    { weightKg: null },
    { weightKg: NaN },
    { age: 0 },
  ])("does not invent missing equation inputs: %j", (missing) =>
    expect(hasMealCalculationInputs({ ...body, ...missing })).toBe(false),
  );
  it("checks before any generative request while preserving a chosen target path", () => {
    const source = readFileSync("src/lib/meal.functions.ts", "utf8");
    expect(source.indexOf("MEAL_PROFILE_INCOMPLETE")).toBeLessThan(
      source.indexOf("const partOne = await generateOrchestratedJson"),
    );
    expect(source).toContain("data.kcalTarget == null");
  });
});
