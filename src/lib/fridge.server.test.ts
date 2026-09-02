import { describe, expect, it } from "vitest";
import { FridgeRecipeSchema } from "./fridge.schema";
import { fallbackRecipe } from "./fridge.server";

describe("deterministic fridge fallback", () => {
  it("returns a validated recipe calculated from the supplied ingredients", () => {
    const result = fallbackRecipe(["Kiaušiniai", "Varškė", "Avižos"], "lt");

    expect(FridgeRecipeSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      fallback: true,
      title: "Greitas patiekalas iš to, ką turi",
      usedIngredients: ["Kiaušiniai", "Varškė", "Avižos"],
    });
    expect(result.calories).toBeGreaterThan(0);
    expect(result.protein).toBeGreaterThan(0);
  });

  it("keeps an English fallback usable for ingredients outside the known food table", () => {
    const result = fallbackRecipe(["mystery ingredient"], "en");

    expect(FridgeRecipeSchema.parse(result)).toMatchObject({
      fallback: true,
      title: "Quick dish from what you have",
      usedIngredients: ["mystery ingredient"],
    });
  });
});
