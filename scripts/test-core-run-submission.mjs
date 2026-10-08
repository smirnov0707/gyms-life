import { expect } from "@playwright/test";
import path from "node:path";

/** Native IndexedDB and real QuickRunLog; only remote service responses are synthetic. */
export async function verifyRunSubmissionRecovery({ open, record, artifacts }) {
  const state = (page) => page.evaluate(() => window.__enduranceLog);
  const controls = (page, lt = false) => ({
    duration: page.getByRole("textbox", { name: lt ? "Trukmė minutėmis" : "Duration in minutes" }),
    distance: page.getByRole("textbox", {
      name: lt ? "Atstumas kilometrais" : "Distance in kilometres",
    }),
    save: page.getByRole("button", {
      name: lt ? "Užskaityti bėgimą" : "Credit this run",
      exact: true,
    }),
    retry: page.getByRole("button", {
      name: lt ? "Pakartoti tą patį išsaugojimą" : "Retry the same save",
      exact: true,
    }),
  });
  const prepare = async (extra = "", lt = false) => {
    const opened = await open(
      `screen=runlog&scenario=matched&lang=${lt ? "lt" : "en"}&theme=${lt ? "light" : "dark"}&${extra}`,
      { width: lt ? 320 : 390, height: 844 },
    );
    await opened.page.emulateMedia({ reducedMotion: "reduce" });
    await opened.page.evaluate(() => document.fonts.ready);
    const c = controls(opened.page, lt);
    await expect(c.save).toBeEnabled();
    await c.duration.fill("30");
    await c.distance.fill("5");
    return { ...opened, c };
  };
  for (const reload of [false, true]) {
    const { page, context, c } = await prepare("submission=response-lost", reload);
    await c.save.click();
    await expect(c.retry).toBeEnabled();
    const original = (await state(page)).lastSubmission;
    expect(await state(page)).toMatchObject({ records: 1, trainingEvents: 0 });
    if (reload) {
      await page.reload();
      await expect(c.retry).toBeEnabled();
      await expect(c.duration).toHaveValue("30");
      await expect(c.save).toBeDisabled();
      expect((await state(page)).deliveries).toBe(0);
    }
    await c.retry.click();
    await expect(c.retry).toHaveCount(0);
    await expect(c.duration).toHaveValue("");
    expect(await state(page)).toMatchObject({
      records: 1,
      trainingEvents: 0,
      enduranceEvents: 1,
      lastSubmission: original,
    });
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText(
      reload ? "Dublikatas nesukurtas" : "No duplicate created",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    if (artifacts && reload)
      await page.screenshot({
        path: path.join(artifacts, "run-submission-recovered-lt-320.png"),
        fullPage: true,
      });
    await context.close();
    record(
      `Original run: lost response recovers ${reload ? "after native page reload" : "in place"} without a second record or completion event`,
    );
  }
  {
    const { page, context, c } = await prepare("submission=fail-before");
    await c.save.click();
    await expect(c.retry).toBeEnabled();
    const original = (await state(page)).lastSubmission;
    expect((await state(page)).records).toBe(0);
    await page.reload();
    await expect(c.retry).toBeEnabled();
    await c.retry.click();
    await expect(c.retry).toHaveCount(0);
    expect(await state(page)).toMatchObject({
      records: 1,
      trainingEvents: 1,
      lastSubmission: original,
    });
    await context.close();
    record(
      "Original run: request that never reached the server keeps its timestamp and ID through reload",
    );
  }
  {
    const { page, context, c } = await prepare("submission=wrong-owner");
    await c.save.click();
    await expect(c.retry).toBeEnabled();
    expect(await state(page)).toMatchObject({ records: 1, trainingEvents: 0 });
    await expect(c.duration).toHaveValue("30");
    await c.retry.click();
    await expect(c.retry).toHaveCount(0);
    expect(await state(page)).toMatchObject({ records: 1, trainingEvents: 0 });
    await context.close();
    record("Original run: a receipt for a different owner cannot clear the retained request");
  }
  {
    const { page, context, c } = await prepare();
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (stores, mode, options) {
        if (this.name === "gyms_life_run_submission_v1" && mode === "readwrite")
          throw new DOMException("Synthetic quota rejection", "QuotaExceededError");
        return original.call(this, stores, mode, options);
      };
    });
    await c.save.click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    expect(await state(page)).toMatchObject({ records: 0, deliveries: 0, trainingEvents: 0 });
    await expect(c.duration).toHaveValue("30");
    await context.close();
    record(
      "Original run: refused durable storage prevents all network submissions instead of falling back to an unkeyed save",
    );
  }
  {
    const { page, context, c } = await prepare();
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      let writes = 0;
      IDBDatabase.prototype.transaction = function (stores, mode, options) {
        if (this.name === "gyms_life_run_submission_v1" && mode === "readwrite" && ++writes === 2)
          throw new DOMException("Synthetic acknowledgment storage failure", "QuotaExceededError");
        return original.call(this, stores, mode, options);
      };
    });
    await c.save.click();
    await expect(c.retry).toBeEnabled();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();
    expect(await state(page)).toMatchObject({ records: 1, trainingEvents: 1 });
    await c.retry.click();
    await expect(c.retry).toHaveCount(0);
    expect(await state(page)).toMatchObject({ records: 1, trainingEvents: 1, enduranceEvents: 2 });
    await context.close();
    record(
      "Original run: failed local acknowledgment cleanup replays the same row without a second completion event",
    );
  }
  {
    const { page, context, c } = await prepare("submission=response-lost");
    await c.save.click();
    await expect(c.retry).toBeEnabled();
    const request = (await state(page)).lastSubmission;
    await page.evaluate(() =>
      window.__submissionAuth.setOwner("10000000-0000-4000-8000-000000000099"),
    );
    await expect(c.save).toBeEnabled();
    await expect(c.duration).toHaveValue("");
    await expect(c.retry).toHaveCount(0);
    await page.evaluate((owner) => window.__submissionAuth.setOwner(owner), request.ownerId);
    await expect(c.retry).toBeEnabled();
    await expect(c.duration).toHaveValue("30");
    await c.retry.click();
    await expect(c.retry).toHaveCount(0);
    expect((await state(page)).records).toBe(1);
    await context.close();
    record(
      "Original run: another signed-in owner cannot see or consume the retained request; original owner can recover it",
    );
  }
  {
    const { page, context, c } = await prepare("submission=held");
    await c.save.click();
    await expect
      .poll(() => page.evaluate(() => typeof window.__releaseManualResponse))
      .toBe("function");
    await page.evaluate(() =>
      window.__submissionAuth.setOwner("10000000-0000-4000-8000-000000000099"),
    );
    await expect(c.save).toBeEnabled();
    await expect(c.duration).toHaveValue("");
    await page.evaluate(() => window.__releaseManualResponse());
    await expect.poll(async () => (await state(page)).records).toBe(1);
    expect((await state(page)).trainingEvents).toBe(0);
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await context.close();
    record(
      "Original run: a late response after account change cannot credit or paint the next account",
    );
  }
  {
    const { page, context, c } = await prepare("submission=response-lost");
    const second = await context.newPage();
    await second.goto(page.url());
    const other = controls(second);
    await expect(other.save).toBeEnabled();
    await other.duration.fill("35");
    await other.distance.fill("6");
    await Promise.all([c.save.click(), other.save.click()]);
    await expect(c.retry).toBeEnabled();
    await expect(other.retry).toBeEnabled();
    const requests = await page.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem("synthetic-manual-runs") ?? "{}")),
    );
    expect(requests).toHaveLength(1);
    expect((await state(page)).deliveries + (await state(second)).deliveries).toBe(1);
    await context.close();
    record(
      "Original run: native cross-tab transactions retain one unresolved request instead of replacing its identity",
    );
  }
}
