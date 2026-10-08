import { expect } from "@playwright/test";
import path from "node:path";
const prefix = "gyms_life_run_follow_up_v1:";
export async function verifyRunContinuity({ open, record, artifacts }) {
  const prepare = async (query, lang = "en") => {
    const opened = await open(`screen=runlog&${query}&lang=${lang}`, { width: 320, height: 844 });
    await opened.page.emulateMedia({ reducedMotion: "reduce" });
    return opened;
  };
  const save = async (page, lt = false) => {
    await page
      .getByRole("textbox", { name: lt ? "Trukmė minutėmis" : "Duration in minutes" })
      .fill("30");
    await page
      .getByRole("textbox", { name: lt ? "Atstumas kilometrais" : "Distance in kilometres" })
      .fill("5");
    await page
      .getByRole("button", { name: lt ? "Užskaityti bėgimą" : "Credit this run", exact: true })
      .click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();
    // An earlier toast may still be visible. The current form must receive
    // its own acknowledgement and finish refreshing before navigation.
    await expect(
      page.getByRole("textbox", { name: lt ? "Trukmė minutėmis" : "Duration in minutes" }),
    ).toHaveValue("");
    await expect(
      page.getByRole("button", { name: lt ? "Užskaityti bėgimą" : "Credit this run", exact: true }),
    ).toBeEnabled();
  };
  const state = (page) => page.evaluate(() => window.__enduranceLog);
  for (const theme of ["dark", "light"]) {
    const { page, context } = await prepare(`scenario=unavailable&theme=${theme}`, "lt");
    await save(page, true);
    const id = (await state(page)).lastSubmissionId;
    const originalUrl = page.url();
    await page.goto(originalUrl.replace("screen=runlog", "screen=training"));
    await page.goto(originalUrl);
    const panel = page.locator("[data-run-follow-up]");
    await expect(panel).toContainText("Liko ankstesnių plano patikrų");
    expect(await state(page)).toMatchObject({ saves: 1, records: 1, retries: 0 });
    await expect(page.getByRole("button", { name: "Taip, užskaityti", exact: true })).toHaveCount(
      0,
    );
    expect(
      await panel
        .locator("[data-system-notice]")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    const buttons = page.locator("[data-run-console] button");
    for (const button of await buttons.all()) {
      const bounds = await button.boundingBox();
      if (bounds) {
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
      }
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Lauke", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("Trukmė · min", { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(artifacts, `run-continuity-${theme}-320.png`),
      fullPage: true,
    });
    await panel.locator("[data-run-follow-up-check]").click();
    await expect(page.getByRole("status")).toContainText("Išsaugotas bėgimas susietas su planu.");
    expect(await state(page)).toMatchObject({
      saves: 1,
      records: 1,
      retries: 1,
      trainingEvents: 0,
      lastRetry: { workoutSessionId: id },
    });
    expect(Object.keys((await state(page)).lastRetry)).toEqual(["workoutSessionId"]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Užskaityti bėgimą", exact: true }),
    ).toBeEnabled();
    await expect(page.locator("[data-run-follow-up]")).toHaveCount(0);
    await context.close();
    record(
      `Run continuity ${theme}: navigation restores references only, explicit check reuses saved ID, readable 320px and reduced motion`,
    );
  }
  {
    const { page, context } = await prepare("scenario=unavailable");
    await save(page);
    const first = (await state(page)).lastSubmissionId;
    await expect(page.getByRole("button", { name: "Credit this run", exact: true })).toBeEnabled();
    await save(page);
    const second = (await state(page)).lastSubmissionId;
    expect(second).not.toBe(first);
    await page.reload();
    const checks = page.locator("[data-run-follow-up-check]");
    await expect(checks).toHaveCount(2);
    await checks.first().click();
    await expect(checks).toHaveCount(1);
    expect((await state(page)).lastRetry).toEqual({ workoutSessionId: first });
    await checks.first().click();
    await expect(checks).toHaveCount(0);
    expect(await state(page)).toMatchObject({
      records: 2,
      saves: 2,
      retries: 2,
      lastRetry: { workoutSessionId: second },
    });
    await context.close();
    record(
      "Run continuity: two unresolved runs survive reload; completing one preserves the other",
    );
  }
  for (const accept of [true, false]) {
    const { page, context } = await prepare("scenario=needs-confirmation&retry=needs-confirmation");
    await save(page);
    await expect(page.getByRole("button", { name: "Yes, count it", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-run-follow-up-check]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, count it", exact: true })).toHaveCount(0);
    expect((await state(page)).confirmations).toBe(0);
    await page.locator("[data-run-follow-up-check]").click();
    await page.getByRole("button", { name: accept ? "Yes, count it" : "No", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate((p) => Object.keys(sessionStorage).filter((k) => k.startsWith(p)), prefix),
      )
      .toEqual([]);
    expect(await state(page)).toMatchObject({
      saves: 1,
      records: 1,
      confirmations: accept ? 1 : 0,
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Credit this run", exact: true })).toBeEnabled();
    await expect(page.locator("[data-run-follow-up-check]")).toHaveCount(0);
    await context.close();
    record(
      `Run continuity: restored suggestion requires new evidence and explicit ${accept ? "acceptance" : "rejection"}`,
    );
  }
  {
    const { page, context } = await prepare("scenario=unavailable");
    await save(page);
    const corrupted = await page.evaluate((p) => {
      const key = Object.keys(sessionStorage).find((k) => k.startsWith(p));
      const value = JSON.parse(sessionStorage.getItem(key));
      value.ownerId = "99999999-9999-4999-8999-999999999999";
      sessionStorage.setItem(key, JSON.stringify(value));
      return { key, raw: sessionStorage.getItem(key) };
    }, prefix);
    await page.reload();
    await expect(page.locator("[data-follow-up-storage-warning]")).toBeVisible();
    await expect(page.locator("[data-run-follow-up-check]")).toHaveCount(0);
    expect(await page.evaluate((k) => sessionStorage.getItem(k), corrupted.key)).toBe(
      corrupted.raw,
    );
    expect((await state(page)).retries).toBe(0);
    await context.close();
    record(
      "Run continuity: foreign hint payload is not rendered, overwritten or automatically retried",
    );
  }
  {
    const { page, context } = await prepare("scenario=unavailable");
    await page.evaluate((p) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith(p)) throw Error("Synthetic follow-up storage refusal");
        return original.call(this, key, value);
      };
    }, prefix);
    await save(page);
    await expect(page.locator("[data-follow-up-storage-warning]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry plan check", exact: true })).toBeEnabled();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    expect(await state(page)).toMatchObject({ saves: 1, records: 1, trainingEvents: 1 });
    await context.close();
    record("Run continuity: secondary retention refusal never misreports the acknowledged save");
  }
  {
    const { page, context } = await prepare("scenario=unavailable&retry=load-unavailable");
    await save(page);
    await page.reload();
    await page.locator("[data-run-follow-up-check]").click();
    await expect(page.getByRole("status")).toContainText("The earlier run could not be verified.");
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: "Retry plan check", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Retry plan check", exact: true }),
      ).toBeEnabled();
      await expect(page.getByRole("status")).toContainText(
        "The earlier run could not be verified.",
      );
    }
    expect(await state(page)).toMatchObject({
      records: 1,
      saves: 1,
      retries: 3,
      trainingEvents: 0,
    });
    expect(
      await page.evaluate(
        (p) => Object.keys(sessionStorage).filter((k) => k.startsWith(p)).length,
        prefix,
      ),
    ).toBe(1);
    await context.close();
    record(
      "Run continuity: repeated unavailable readback stays unverified and never creates a new run",
    );
  }
}
