import { expect } from "@playwright/test";
import path from "node:path";

/** Real QuickRunLog; only service boundaries and their account data are synthetic. */
export async function verifyEnduranceRunLog({ open, record, artifacts }) {
  const values = async (page) => page.evaluate(() => window.__enduranceLog);
  const prepare = async (query, lang = "en") => {
    const opened = await open(`screen=runlog&${query}&lang=${lang}`, {
      width: lang === "lt" ? 320 : 390,
      height: 844,
    });
    await opened.page.emulateMedia({ reducedMotion: "reduce" });
    await opened.page.evaluate(() => document.fonts.ready);
    await opened.page
      .getByRole("textbox", { name: lang === "lt" ? "Trukmė minutėmis" : "Duration in minutes" })
      .fill("30");
    await opened.page
      .getByRole("textbox", {
        name: lang === "lt" ? "Atstumas kilometrais" : "Distance in kilometres",
      })
      .fill("5");
    return opened;
  };
  for (const lang of ["en", "lt"]) {
    const { page, context } = await prepare(
      `scenario=matched&refresh=fail&theme=${lang === "lt" ? "light" : "dark"}`,
      lang,
    );
    await page
      .getByRole("button", {
        name: lang === "lt" ? "Užskaityti bėgimą" : "Credit this run",
        exact: true,
      })
      .click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();
    await expect(page.locator('[data-sonner-toast][data-type="warning"]')).toBeVisible();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    await expect(
      page.getByRole("textbox", {
        name: lang === "lt" ? "Trukmė minutėmis" : "Duration in minutes",
      }),
    ).toHaveValue("");
    expect(await values(page)).toMatchObject({
      saves: 1,
      records: 1,
      refreshes: 1,
      trainingEvents: 1,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await context.close();
    record(`Run log ${lang}: screen refresh failure never misreports the successful save`);
  }
  {
    const { page, context } = await prepare("scenario=unavailable&theme=light", "lt");
    await page.getByRole("button", { name: "Užskaityti bėgimą", exact: true }).dblclick();
    await expect(page.getByRole("status")).toContainText("Bėgimas išsaugotas.");
    await page.getByRole("button", { name: "Pakartoti plano patikrą", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Išsaugotas bėgimas susietas su planu.");
    expect(await values(page)).toMatchObject({
      saves: 1,
      records: 1,
      retries: 1,
      trainingEvents: 1,
      enduranceEvents: 2,
      lastRetry: { workoutSessionId: "20000000-0000-4000-8000-000000000002" },
    });
    expect(Object.keys((await values(page)).lastRetry)).toEqual(["workoutSessionId"]);
    await expect(page.getByRole("button", { name: "Pakartoti plano patikrą" })).toHaveCount(0);
    if (artifacts)
      await page.screenshot({
        path: path.join(artifacts, "endurance-run-retried-lt.png"),
        fullPage: true,
      });
    await context.close();
    record(
      "Run log: double activation saves once; retry sends only the saved ID and emits no new training event",
    );
  }
  {
    const { page, context } = await prepare("scenario=linked-refresh-fails");
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Run saved and linked.");
    await page.getByRole("button", { name: "Retry plan check", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved run is linked to the plan.");
    expect(await values(page)).toMatchObject({ saves: 1, records: 1, retries: 1, linked: true });
    await context.close();
    record("Run log: post-link analysis failure is separate from the committed plan match");
  }
  {
    const { page, context } = await prepare("scenario=save-fails");
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Duration in minutes" })).toHaveValue("30");
    await expect(page.getByRole("button", { name: "Retry plan check" })).toHaveCount(0);
    expect(await values(page)).toMatchObject({ records: 0, trainingEvents: 0, retries: 0 });
    await context.close();
    record("Run log: a real persistence failure keeps the draft and emits no completion");
  }
  {
    const { page, context } = await prepare("scenario=retry-fails");
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await page.getByRole("button", { name: "Retry plan check", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(
      "Run remains saved.",
    );
    expect(await values(page)).toMatchObject({ saves: 1, records: 1, retries: 1 });
    await expect(page.getByRole("button", { name: "Retry plan check" })).toBeEnabled();
    await context.close();
    record("Run log: failed secondary retry neither erases nor resubmits the run");
  }
  {
    const { page, context } = await prepare("scenario=needs-confirmation&confirm=response-lost");
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await page.getByRole("button", { name: "Yes, count it", exact: true }).click();
    await page.getByRole("button", { name: "Retry plan check", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Saved run is linked to the plan.");
    expect(await values(page)).toMatchObject({
      saves: 1,
      records: 1,
      confirmations: 1,
      retries: 1,
      trainingEvents: 1,
    });
    await context.close();
    record("Run log: lost confirmation response recovers through readback, not another save");
  }
  {
    const { page, context } = await prepare("scenario=matched");
    await page.getByRole("textbox", { name: "Perceived effort from 1 to 10" }).fill("11");
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    expect(await values(page)).toMatchObject({ saves: 0, records: 0 });
    await context.close();
    record("Run log: invalid effort never reaches persistence");
  }
}
