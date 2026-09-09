import { expect } from "@playwright/test";

/** Simulated service responses test real component writes/cache updates, not a live provider. */
export async function verifyCoreActions({ open, record }) {
  {
    const { page, context } = await open("screen=activation&scenario=empty");
    await expect(
      page.getByText("You do not have an active training program yet.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Activate program", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByRole("heading", { name: "Synthetic training programme", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.activatePlan)).toBe(1);
    expect(await page.evaluate(() => window.__core.counts.getActivePlan)).toBeGreaterThan(1);
    await context.close();
    record(
      "activation refreshes a previously cached empty programme and double-click submits once",
    );
  }
  {
    const { page, context } = await open("screen=meals");
    await expect(page.getByLabel("Allergies", { exact: true })).toHaveValue("peanuts");
    await page.getByRole("button", { name: "New plan", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByRole("heading", { name: "Generated synthetic meal plan", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.generateMealPlan)).toBe(1);
    expect(await page.evaluate(() => window.__core.last.generateMealPlan)).toMatchObject({
      diet: "vegan",
      allergies: "peanuts",
      dislikes: "mushrooms",
      mealsPerDay: 4,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Generated synthetic meal plan", exact: true }),
    ).toBeVisible();
    await context.close();
    record(
      "meal generation preserves saved restrictions, serializes clicks and reloads the saved result",
    );
  }
  {
    const { page, context } = await open("screen=meals&fail=generate");
    await expect(
      page.getByRole("heading", { name: "Synthetic seven-day meal plan", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New plan", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__core.counts.generateMealPlan ?? 0))
      .toBe(1);
    await expect(page.getByRole("button", { name: "New plan", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.__core.meal.data.title)).toBe(
      "Synthetic seven-day meal plan",
    );
    await expect(
      page.getByRole("heading", { name: "Synthetic seven-day meal plan", exact: true }),
    ).toBeVisible();
    await context.close();
    record("failed meal generation leaves the previous plan intact and the form usable");
  }
  {
    const { page, context } = await open("screen=meals");
    await expect(page.getByRole("button", { name: "Adapt plan", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Adapt plan", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByRole("heading", { name: "Adapted synthetic meal plan", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.adaptMealPlan)).toBe(1);
    expect(await page.evaluate(() => window.__core.last.adaptMealPlan)).toMatchObject({
      planId: "33333333-3333-4333-8333-333333333333",
      version: "2026-09-09T12:00:00.000Z",
      timeZone: "Europe/Vilnius",
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Adapted synthetic meal plan", exact: true }),
    ).toBeVisible();
    await context.close();
    record("adaptation submits the displayed plan version once and persists across reload");
  }
  {
    const { page, context } = await open("screen=onboarding");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Resistance bands", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#w")).toHaveValue("68");
    await page.locator("#w").fill("68,5");
    await page.getByRole("button", { name: "Generate plan", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Synthetic training programme", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.last.generatePlan)).toMatchObject({
      weightKg: 68.5,
      gender: "female",
      limitations: "Existing synthetic restriction",
      equipment: ["bodyweight", "band"],
    });
    await context.close();
    record(
      "quick intake sends validated decimal body values, retained limitations and actual equipment",
    );
  }
  {
    const { page, context } = await open("screen=nutrition");
    const field = page.locator('input[maxlength="400"]');
    await field.fill("Synthetic lunch");
    await field.evaluate((input) => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await expect(field).toHaveValue("");
    expect(await page.evaluate(() => window.__core.counts.logMeal)).toBe(1);
    await expect(page.getByText("1000kcal", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("1000kcal", { exact: true })).toBeVisible();
    await context.close();
    record(
      "rapid Enter logs one food entry, refreshes the complete daily total and retains it on reload",
    );
  }
  {
    const { page, context } = await open("screen=training&scenario=empty");
    await expect(
      page.getByText("You do not have an active training program yet.", { exact: true }),
    ).toBeVisible();
    await page.locator("summary").filter({ hasText: "Saved programmes" }).click();
    await expect(
      page.getByRole("heading", { name: "Synthetic training programme", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Activate program", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Synthetic training programme", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You do not have an active training program yet.", { exact: true }),
    ).toHaveCount(0);
    await context.close();
    record(
      "saved inactive programme is recovered and activated without another generation request",
    );
  }
}
