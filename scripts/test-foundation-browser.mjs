import { expect } from "@playwright/test";
import path from "node:path";
/** Merge regressions on real components, isolated synthetic service responses. */
export async function verifyFoundationMerge({ open, record, artifacts }) {
  const key = "gyms_life_offline_queue_v2";
  for (const lang of ["en", "lt"]) {
    const { page, context } = await open(`screen=workout&scenario=new-workout&lang=${lang}`);
    const start = lang === "en" ? "Start or resume workout" : "Pradėti arba tęsti treniruotę";
    const save = lang === "en" ? "Log set" : "Registruoti setą";
    await page.getByRole("button", { name: start, exact: true }).click();
    await page.locator("#set-reps").fill("8");
    await page.locator("#set-weight").fill("20");
    const original = JSON.stringify(
      Array.from({ length: 200 }, (_, index) => ({
        id: `synthetic-capacity-${index}`,
        type: "workout_set",
        timestamp: 1788955200000 + index,
        data: {
          sessionId: "66666666-6666-4666-8666-666666666666",
          exerciseSlug: "squat",
          exerciseName: "Synthetic retained set",
          setNumber: index + 1,
          reps: 8,
          weightKg: 20,
          rpe: null,
          done: true,
        },
      })),
    );
    await page.evaluate((rows) => window.__offlineFixture.seed(rows), JSON.parse(original));
    const originalOwned = JSON.stringify(await page.evaluate(() => window.__offlineFixture.read()));
    await context.setOffline(true);
    await page.getByRole("button", { name: save, exact: true }).click();
    const message =
      lang === "en"
        ? "This device is holding as many offline sets as it can. Your earlier sets are safe — reconnect to send them, then log this one."
        : "Šis įrenginys nebetalpina daugiau neprisijungus įrašytų serijų. Ankstesnės serijos išsaugotos – atkurkite ryšį, kad jos būtų persiųstos, ir tada įrašykite šią.";
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    expect(JSON.stringify(await page.evaluate(() => window.__offlineFixture.read()))).toBe(
      originalOwned,
    );
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await context.close();
    record(
      `foundation ${lang}: a full offline queue retains all earlier rows and main's actionable error`,
    );
  }

  {
    const { page, context } = await open("screen=workout&scenario=new-workout");
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await page.locator("#set-reps").fill("8");
    await page.locator("#set-weight").fill("20");
    // Real browser offline state. Components and styles have already loaded.
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.getByRole("button", { name: "Log set", exact: true }).click();
    await expect(
      page.getByText("Set saved on this device and will sync when you reconnect.", { exact: true }),
    ).toBeVisible();
    const queued = await page.evaluate(() => window.__offlineFixture.read());
    expect(queued).toHaveLength(1);
    expect(queued[0].data).toMatchObject({ setNumber: 1, reps: 8, weightKg: 20, done: true });
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await expect(
      page.getByText(/Set 2 of 3|Set 2 \/ 3|2 \/ 3/, { exact: false }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(artifacts, "foundation-offline-ack.png"),
      fullPage: true,
    });
    await context.close();
    record(
      "foundation: an offline set keeps its recorded set identity and advances once without server acknowledgement",
    );
  }
  {
    const { page, context } = await open("screen=workout&scenario=new-workout");
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await page.locator("#set-reps").fill("8");
    await page.locator("#set-weight").fill("20");
    const original = JSON.stringify([
      {
        id: "synthetic-earlier-set",
        type: "workout_set",
        timestamp: 1788955200000,
        data: {
          sessionId: "66666666-6666-4666-8666-666666666666",
          exerciseSlug: "squat",
          exerciseName: "Synthetic earlier session",
          setNumber: 1,
          reps: 8,
          weightKg: 20,
          rpe: null,
          done: true,
        },
      },
    ]);
    await page.evaluate((rows) => window.__offlineFixture.seed(rows), JSON.parse(original));
    const originalOwned = JSON.stringify(await page.evaluate(() => window.__offlineFixture.read()));
    await page.evaluate(
      ({ key, original }) => {
        localStorage.setItem(key, original);
        window.__offlineFixture.rejectWrites();
      },
      { key, original },
    );
    await context.setOffline(true);
    await page.getByRole("button", { name: "Log set", exact: true }).click();
    await expect(
      page.getByText(
        "This device has no room left to store the set. Your earlier sets are safe — free some space or reconnect to send them.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(original);
    expect(JSON.stringify(await page.evaluate(() => window.__offlineFixture.read()))).toBe(
      originalOwned,
    );
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await expect(page.locator("#set-reps")).toHaveValue("8");
    await context.close();
    record(
      "foundation: storage refusal preserves the earlier raw queue and the actionable error instead of a false save",
    );
  }
  {
    const { page, context } = await open("screen=workout&scenario=new-workout&fail=setNetwork");
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await page.locator("#set-reps").fill("8");
    await page.locator("#set-weight").fill("20");
    await page.getByRole("button", { name: "Log set", exact: true }).click();
    await expect(
      page.getByText("Set saved on this device and will sync when you reconnect.", { exact: true }),
    ).toBeVisible();
    const queued = await page.evaluate(() => window.__offlineFixture.read());
    expect(queued).toHaveLength(1);
    expect(queued[0].data.setNumber).toBe(1);
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet)).toBe(1);
    await expect(page.getByText("Set 2 / 3", { exact: true })).toBeVisible();
    await context.close();
    record(
      "foundation: a rejected network request retains the same recorded-set acknowledgement when queued locally",
    );
  }
  {
    const { page, context } = await open("screen=workout&scenario=new-workout");
    const start = page.getByRole("button", { name: "Start or resume workout", exact: true });
    await expect(start).toBeEnabled();
    await context.setOffline(true);
    await start.click();
    await expect(
      page.getByText(
        "Reconnect to start or resume your workout. A started workout can record sets on this device.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.startWorkout ?? 0)).toBe(0);
    await expect(start).toBeEnabled();
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__core.counts.startWorkout ?? 0)).toBe(0);
    await start.click();
    for (let exercise = 0; exercise < 2; exercise++) {
      await expect(
        page.getByRole("heading", { name: exercise === 0 ? "push-up" : "squat", exact: true }),
      ).toBeVisible();
      await page.locator("#set-reps").fill("8");
      await page.locator("#set-weight").fill("20");
      for (let set = 1; set <= 3; set++) {
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
    const finish = page.getByRole("button", { name: "Finish workout", exact: true });
    await context.setOffline(true);
    await finish.click();
    await expect(
      page.getByText("Reconnect so your sets are saved before finishing the workout.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.finishWorkout ?? 0)).toBe(0);
    await expect(finish).toBeEnabled();
    expect(await page.evaluate(() => window.__core.workoutSession.logs.length)).toBe(6);
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__core.counts.finishWorkout ?? 0)).toBe(0);
    await finish.click();
    await expect(page.getByRole("heading", { name: "Workout saved", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.finishWorkout)).toBe(1);
    await context.close();
    record(
      "foundation: offline start/finish return immediate instructions, do not execute on reconnect, and explicit retries complete once",
    );
  }
}
