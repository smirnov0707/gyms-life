import { describe, expect, it } from "vitest";
import { calculateDishFit } from "./dish-fit.engine";

describe("calculateDishFit", () => {
  it("decides nothing when the dish states no energy", () => {
    expect(calculateDishFit({ calories: 0, protein: 30, fat: 5 }, "muscle_gain")).toEqual({
      band: null,
      proteinPer100Kcal: null,
      fatSharePct: null,
    });
  });

  it("reports the basis it judged from", () => {
    // 480 kcal, 38 g protein -> 7.9 g/100 kcal; 14 g fat -> 126 kcal -> 26.3%
    const fit = calculateDishFit({ calories: 480, protein: 38, fat: 14 }, "muscle_gain");
    expect(fit.proteinPer100Kcal).toBe(7.9);
    expect(fit.fatSharePct).toBe(26.3);
  });

  it("rates a protein-dense plate strongly for muscle gain", () => {
    expect(calculateDishFit({ calories: 480, protein: 38, fat: 14 }, "muscle_gain").band).toBe(
      "strong",
    );
  });

  it("rates fries poorly for muscle gain", () => {
    // 350 kcal, 4 g protein -> 1.1 g/100 kcal
    expect(calculateDishFit({ calories: 350, protein: 4, fat: 17 }, "muscle_gain").band).toBe(
      "poor",
    );
  });

  it("rates a burger as workable rather than strong for muscle gain", () => {
    // 500 kcal, 25 g protein -> 5 g/100 kcal
    expect(calculateDishFit({ calories: 500, protein: 25, fat: 25 }, "muscle_gain").band).toBe(
      "workable",
    );
  });

  it("counts size against a protein-dense but huge dish when cutting", () => {
    const small = calculateDishFit({ calories: 480, protein: 38, fat: 14 }, "fat_loss");
    const huge = calculateDishFit({ calories: 1200, protein: 95, fat: 35 }, "fat_loss");
    expect(small.band).toBe("strong");
    // Same density, four times the plate.
    expect(huge.proteinPer100Kcal).toBe(7.9);
    expect(huge.band).toBe("poor");
  });

  it("judges balance rather than protein when the goal is health", () => {
    // Fat-heavy: 700 kcal, 30 g protein, 45 g fat -> 57.9% of energy from fat
    expect(calculateDishFit({ calories: 700, protein: 30, fat: 45 }, "healthy").band).toBe("poor");
    // Lean and adequately protein-dense: 700 kcal, 40 g protein (5.7 per 100
    // kcal), 18 g fat -> 23.1% of energy from fat.
    expect(calculateDishFit({ calories: 700, protein: 40, fat: 18 }, "healthy").band).toBe(
      "strong",
    );
  });

  it("does not let one goal's verdict stand in for another's", () => {
    const dish = { calories: 1200, protein: 95, fat: 35 };
    expect(calculateDishFit(dish, "muscle_gain").band).toBe("strong");
    expect(calculateDishFit(dish, "fat_loss").band).toBe("poor");
  });
});
