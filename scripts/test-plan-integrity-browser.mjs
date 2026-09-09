import { expect } from "@playwright/test";
/** Real views, with explicit synthetic persistence and generation boundaries. */
export async function verifyPlanIntegrity({ open, record }) {
  {
    const { page, context } = await open("screen=meals&scenario=recipe-conflict");
    const notice = page.getByRole("alert", { name: "Recipe review" });
    await expect(notice).toContainText("Peanut butter 20 g");
    await page.screenshot({
      path: "test-results/core-browser/recipe-conflict.png",
      fullPage: true,
    });
    await expect(
      page.getByRole("heading", { name: "Synthetic seven-day meal plan", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.meal.data.title)).toBe(
      "Synthetic seven-day meal plan",
    );
    await context.close();
    record("saved conflicting recipe is flagged without deleting or disguising the existing plan");
  }
  {
    const { page, context } = await open("screen=meals");
    await expect(page.getByRole("note", { name: "Recipe review" })).toContainText(
      "do not certify allergen-free",
    );
    await expect(page.getByRole("alert", { name: "Recipe review" })).toHaveCount(0);
    await context.close();
    record("no positive allergy-free certification is shown for an unflagged recipe");
  }
  {
    const { page, context } = await open("screen=workout&scenario=workout-gap");
    await page
      .getByRole("button", { name: "Start or resume workout", exact: true })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await expect(page.getByText("Set 2 / 3", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.startWorkout)).toBe(1);
    await page.locator("#set-reps").fill("8");
    await page.locator("#set-weight").fill("20");
    await page.getByRole("button", { name: "Log set", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByText("Exercise complete", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet)).toBe(1);
    expect(
      await page.evaluate(() =>
        window.__core.workoutSession.logs.map((log) => log.set_number).sort(),
      ),
    ).toEqual([1, 2, 3, 4]);
    await context.close();
    record("resume fills actual set 2 gap, retains extra set 4 and does not re-log set 3");
  }
  {
    const { page, context } = await open("screen=workout");
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await expect(page.locator("#set-reps")).toBeVisible();
    await page.evaluate(async () => {
      window.__core.fail = "workoutRead";
      await window.__coreQueries.invalidateQueries({ queryKey: ["workout"] });
    });
    await expect(page.getByRole("heading", { name: "push-up", exact: true })).toBeVisible();
    await expect(page.getByText("The workout could not be loaded.", { exact: true })).toHaveCount(
      0,
    );
    await context.close();
    record(
      "a background next-workout read failure cannot hide the already started execution snapshot",
    );
  }
  {
    const { page, context } = await open("screen=workout");
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    for (let exercise = 0; exercise < 2; exercise++) {
      await expect(
        page.getByRole("heading", { name: exercise === 0 ? "push-up" : "squat", exact: true }),
      ).toBeVisible();
      await expect(page.locator("#set-reps")).toBeVisible();
      await page.locator("#set-reps").fill("8");
      await page.locator("#set-weight").fill("20");
      for (let set = 1; set <= 3; set++) {
        await expect(page.locator("#set-reps")).toHaveValue("8");
        await page.getByRole("button", { name: "Log set", exact: true }).click();
        if (set < 3) {
          await expect(page.getByText(`Set ${set + 1} / 3`, { exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Skip", exact: true }).click();
        }
      }
      await expect(page.getByText("Exercise complete", { exact: true })).toBeVisible();
      if (exercise === 0)
        await page.getByRole("button", { name: "Next exercise", exact: true }).click();
    }
    await page.getByRole("button", { name: "Finish workout", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.finishWorkout)).toBe(1);
    expect(await page.evaluate(() => window.__core.workoutSession.logs.length)).toBe(6);
    await expect(page.getByText("960 kg", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/core-browser/workout-finished.png",
      fullPage: true,
    });
    await expect(
      page.getByText(/Your workout is saved, but its session replay is temporarily unavailable/),
    ).toBeVisible();
    await context.close();
    record(
      "start → six recorded sets → finish retains the expected logged volume when the optional replay is unavailable",
    );
  }
}
