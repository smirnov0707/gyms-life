import { describe, expect, it } from "vitest";
import { buildShoppingList } from "./shopping-build";
import type { GeneratedMealPlan } from "./meal-plan.schema";

/**
 * The shopping list is what the athlete takes to the shop, so the thing that
 * matters is that a quantity on it is one they can act on: a single total per
 * ingredient, in a unit that exists.
 */

const plan = (days: string[][]): GeneratedMealPlan =>
  ({
    days: days.map((ingredients) => ({ meals: [{ ingredients }] })),
  }) as unknown as GeneratedMealPlan;

const amountOf = (list: ReturnType<typeof buildShoppingList>, name: string) =>
  list.flatMap((group) => group.items).find((item) => item.name === name)?.amount;

describe("buildShoppingList", () => {
  it("adds up grams and kilograms of the same ingredient", () => {
    // Half a kilo on one day and a kilo on another is one and a half kilos of
    // shopping, not two separate things to buy. The display already converted
    // grams to kilos above a thousand, so it knew these were the same
    // dimension; only the addition did not.
    const list = buildShoppingList(plan([["500 g chicken"], ["1 kg chicken"]]), "en");
    expect(amountOf(list, "Chicken")).toBe("1.5 kg");
  });

  it("adds up millilitres and litres the same way", () => {
    const list = buildShoppingList(plan([["300 ml milk"], ["1 l milk"]]), "en");
    expect(amountOf(list, "Milk")).toBe("1.3 l");
  });

  it("keeps a total under a kilo in grams", () => {
    const list = buildShoppingList(plan([["200 g rice"], ["300 g rice"]]), "en");
    expect(amountOf(list, "Rice")).toBe("500 g");
  });

  it("does not merge units that measure different things", () => {
    const list = buildShoppingList(plan([["2 vnt. eggs"], ["100 g eggs"]]), "en");
    const amount = amountOf(list, "Eggs") ?? "";
    expect(amount).toContain("100 g");
    expect(amount).toContain("2");
  });

  it("says 'to taste' for a mention that carried no amount", () => {
    // This used to append a bare count to the quantity, so salt came out as
    // "150 g + +1" — a doubled plus and a number nobody can buy.
    const list = buildShoppingList(plan([["150 g salt"], ["salt"]]), "en");
    expect(amountOf(list, "Salt")).toBe("150 g + to taste");
  });

  it("says only 'to taste' when no mention carried an amount", () => {
    const list = buildShoppingList(plan([["pepper"], ["pepper"]]), "en");
    expect(amountOf(list, "Pepper")).toBe("to taste");
  });

  it("falls back to the plan's own list when nothing could be parsed", () => {
    const supplied = [{ category: "Other", items: [{ name: "Rice", amount: "1 kg" }] }];
    const empty = { days: [], shopping_list: supplied } as unknown as GeneratedMealPlan;
    expect(buildShoppingList(empty, "en")).toEqual(supplied);
  });
});
