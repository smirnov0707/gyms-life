import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyLedgerDesign({ open, record, artifacts }) {
  const captures = [];
  const history = (page) => page.locator(".fl-workout-ledger > details").first();
  for (const screen of ["milestones", "history"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(`screen=${screen}&shell=1&theme=${theme}`, {
          width,
          height: 900,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        if (screen === "history") {
          await expect(history(page).locator("summary")).toHaveText("Recorded training");
          await history(page).locator("summary").press("Enter");
          await expect(page.locator(".fl-workout-entry")).toHaveCount(1);
          await expect(page.locator(".fl-workout-exercise")).toHaveCount(2);
          await expect(page.locator(".fl-workout-entry")).toContainText("— min");
          await expect(page.locator(".fl-workout-entry")).toContainText(
            "2 completed sets · last: 8 reps × 40 kg · RPE 7",
          );
          await expect(page.locator(".fl-workout-entry")).toContainText("— reps × — kg");
          await expect(page.locator(".fl-workout-entry")).not.toContainText("Unfinished exercise");
          expect(await page.evaluate(() => window.__core.last.getWorkoutHistory)).toEqual({
            limit: 20,
          });
        } else {
          await expect(page.locator("[data-milestone-level]")).toHaveText("3");
          await expect(page.locator("[data-milestone-xp]")).toHaveText(/2[,\s]244/);
          await expect(page.locator("[data-milestone-streak]")).toHaveText("10");
          await expect(page.locator(".fl-milestone-badges [data-unlocked=true]")).toHaveCount(6);
          await expect(page.locator(".fl-milestone-calendar span[data-active=true]")).toHaveCount(
            10,
          );
          await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
          const reads = await page.evaluate(() => window.__core.last);
          for (const table of ["workout_sessions", "daily_checkins", "form_analyses"])
            expect(reads["ledgerRead:" + table].filters.user_id).toBe(
              await page.evaluate(() => window.__core.profile.id),
            );
          expect(reads["ledgerRead:workout_sessions"].nonNull).toEqual(["finished_at"]);
        }
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.evaluate(() => scrollTo(0, 0));
        const name = `ledger-${screen}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, name + ".png"),
          fullPage: true,
          animations: "disabled",
        });
        const capture = {
          name,
          screen,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("LEDGER_UI_BEGIN " + JSON.stringify(capture));
          const b = png.toString("base64");
          for (let i = 0; i < b.length; i += 16000)
            console.log("LEDGER_UI_CHUNK " + b.slice(i, i + 16000));
          console.log("LEDGER_UI_END " + name);
        }
        await context.close();
        record(
          `${screen} ${theme} ${width}: recorded values, owner filters and responsive capture`,
        );
      }
  for (const screen of ["milestones", "history"]) {
    const target = (page) =>
      page.locator(screen === "milestones" ? ".fl-milestones" : ".fl-workout-ledger");
    for (const failed of [
      screen + "-pending",
      ...(screen === "milestones"
        ? ["milestones-workout_sessions", "milestones-form_analyses", "milestones-daily_checkins"]
        : ["history"]),
    ]) {
      const { page, context } = await open(`screen=${screen}&fail=${failed}`);
      if (screen === "history") await history(page).locator("summary").press("Enter");
      const pending = failed.endsWith("-pending");
      await expect(target(page).locator(".fl-ledger-state")).toHaveAttribute(
        "data-state",
        pending ? "loading" : "error",
      );
      await expect(
        target(page).locator(
          "[data-milestone-level],.fl-milestone-badges,.fl-milestone-calendar,.fl-workout-entry",
        ),
      ).toHaveCount(0);
      await page.evaluate(() => {
        window.__core.fail = null;
      });
      if (!pending)
        await target(page).getByRole("button", { name: "Try again", exact: true }).press("Enter");
      await expect(
        target(page).locator(
          screen === "milestones" ? "[data-milestone-level]" : ".fl-workout-entry",
        ),
      ).toBeVisible();
      await context.close();
      record(
        `${screen} ${failed}: no invented progress, retry or pending completion restores saved data`,
      );
    }
    {
      const { page, context } = await open(`screen=${screen}&scenario=empty&theme=light&lang=lt`, {
        width: 320,
        height: 900,
      });
      if (screen === "history") await history(page).locator("summary").press("Enter");
      await expect(target(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
      if (screen === "milestones") {
        await expect(page.locator("[data-milestone-xp]")).toHaveText("0");
        await expect(page.locator("[data-milestone-streak]")).toHaveText("0");
        await expect(page.locator(".fl-milestone-badges [data-unlocked=true]")).toHaveCount(0);
        const calendar = page.getByRole("region", { name: "Aktyvumo žemėlapis" });
        await calendar.focus();
        await expect(calendar).toBeFocused();
        await calendar.press("ArrowRight");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await context.close();
      record(`${screen} Lithuanian 320px true empty state and calendar accessibility`);
    }
    {
      const { page, context } = await open(`screen=${screen}`);
      if (screen === "history") await history(page).locator("summary").press("Enter");
      await expect(
        target(page).locator(
          screen === "milestones" ? "[data-milestone-level]" : ".fl-workout-entry",
        ),
      ).toBeVisible();
      await page.evaluate(async (screen) => {
        window.__core.fail = screen;
        await window.__coreQueries.refetchQueries({
          queryKey: [screen === "milestones" ? "achievements" : "workout-history"],
        });
      }, screen);
      await expect(target(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
      await expect(target(page).locator("[data-milestone-level],.fl-workout-entry")).toHaveCount(0);
      await context.close();
      record(`${screen} failed refresh hides stale figures and retains an actionable error`);
    }
  }
  await writeFile(
    path.join(artifacts, "ledger-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
