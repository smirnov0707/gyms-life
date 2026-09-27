import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

async function start(page) {
  await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Reps", exact: true })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Reps", exact: true }).fill("8");
}
async function finish(page) {
  for (let exercise = 0; exercise < 2; exercise++) {
    for (let set = 0; set < 3; set++) {
      await page.getByRole("spinbutton", { name: "Reps", exact: true }).fill("8");
      await page.getByRole("button", { name: "Log set", exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => window.__core.workoutSession.logs.length))
        .toBe(exercise * 3 + set + 1);
      if (set < 2)
        await expect(page.getByText(`Set ${set + 2} / 3`, { exact: true })).toBeVisible();
    }
    await page
      .getByRole("button", { name: exercise ? "Finish workout" : "Next exercise", exact: true })
      .click();
  }
  await expect(page.locator(".fl-workout-summary h1")).toBeVisible();
  // Inspect the permanent summary after its normal confirmation has expired.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10000 });
}

/** Real route components; all account reads and writes use labeled synthetic fixtures. */
export async function verifySessionDesign({ open, record, artifacts }) {
  const captures = [];
  for (const screen of [
    "readiness-empty",
    "readiness-saved",
    "workout-ready",
    "workout-active",
    "workout-complete",
  ]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 390]) {
        const readiness = screen.startsWith("readiness");
        const { page, context } = await open(
          `screen=${readiness ? "readiness" : "workout"}&scenario=${screen === "readiness-empty" ? "empty" : "ready"}&shell=1&theme=${theme}`,
          { width, height: width === 390 ? 844 : 1000 },
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        const workspace = page.locator(".fl-workspace");
        await expect(workspace.locator("h1")).toHaveCount(1);
        if (readiness) {
          await expect(
            page.getByText(
              screen === "readiness-empty"
                ? "No check-in yet today"
                : "Synthetic saved check-in advice.",
              { exact: true },
            ),
          ).toBeVisible();
          if (screen === "readiness-empty") {
            await expect(page.getByRole("slider")).toHaveCount(6);
            for (const name of [
              "Hours of sleep",
              "Sleep quality",
              "Muscle soreness",
              "Stress",
              "Energy",
              "Mood",
            ])
              await expect(page.getByRole("slider", { name, exact: true })).toBeVisible();
          }
        } else {
          await expect(
            page.getByRole("button", { name: "Start or resume workout", exact: true }),
          ).toBeVisible();
          if (screen !== "workout-ready") await start(page);
          if (screen === "workout-complete") await finish(page);
          if (screen === "workout-active") {
            await expect(page.getByRole("spinbutton", { name: "RPE", exact: true })).toBeVisible();
            await expect(
              page.getByRole("progressbar", { name: "Session progress" }),
            ).toHaveAttribute("aria-valuenow", "0");
            await page.evaluate(() => document.fonts.ready);
            // Focus-induced scrolling or font layout between separate browser calls
            // must not mix two viewport origins in the same geometry assertion.
            const geometry = await workspace.evaluate((el) => {
              const log = el.querySelector(".fl-workout-log").getBoundingClientRect();
              const voice = el.querySelector(".fl-workout-voice summary").getBoundingClientRect();
              return { logHeight: log.height, logBottom: log.bottom, voiceTop: voice.top };
            });
            expect(geometry.logHeight).toBeGreaterThanOrEqual(44);
            expect(geometry.logBottom).toBeLessThan(geometry.voiceTop);
            // Ensure native keyboard order follows the same primary-before-secondary layout.
            await page.getByRole("spinbutton", { name: "RPE", exact: true }).focus();
            await page.keyboard.press("Tab");
            await expect(page.getByRole("button", { name: "Log set", exact: true })).toBeFocused();
          }
        }
        await page.evaluate(() => document.fonts.ready);
        const audit = await workspace.evaluate((el) => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          titleFont: getComputedStyle(el.querySelector("h1")).fontFamily,
          nestedMain: document.querySelectorAll("main main").length,
          fonts: [...document.fonts]
            .filter((font) => font.status === "loaded")
            .map((font) => font.family),
        }));
        expect(audit.overflow).toBe(false);
        expect(audit.nestedMain).toBe(0);
        expect(audit.titleFont).toContain("Space Grotesk");
        expect(audit.fonts.some((name) => name.includes("Manrope"))).toBe(true);
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const name = `session-${screen}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, `${name}.png`),
          animations: "disabled",
          fullPage: true,
        });
        const capture = {
          name,
          screen,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
          syntheticFixture: true,
          audit,
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("SESSION_UI_BEGIN " + JSON.stringify(capture));
          const encoded = png.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("SESSION_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("SESSION_UI_END " + name);
        }
        await context.close();
        record(
          `${screen}: ${theme} ${width}px real shell, accessible controls, local fonts and visual capture`,
        );
      }
    }
  }
  {
    const { page, context } = await open("screen=readiness&fail=readiness-pending");
    await expect(page.getByRole("status")).toContainText("Loading today’s check-in");
    await expect(page.getByText("No check-in yet today", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("slider")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = "readiness";
    });
    await expect(page.getByRole("alert")).toContainText("could not be loaded");
    await expect(page.getByText("No check-in yet today", { exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByText("Synthetic saved check-in advice.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.last["read:daily_checkins"])).toMatchObject({
      user_id: "11111111-1111-4111-8111-111111111111",
      checkin_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    await context.close();
    record(
      "readiness loading and failed reads are distinct from an empty day; retry restores the saved check-in",
    );
  }
  {
    const { page, context } = await open("screen=readiness&scenario=missing-readiness");
    await expect(page.locator(".fl-readiness-metrics")).toBeVisible();
    await expect(page.locator(".fl-readiness-metrics")).not.toContainText("100%");
    expect(
      await page.locator(".fl-readiness-metrics .fl-workspace-number").allTextContents(),
    ).toEqual(["—/ 100", "—"]);
    await context.close();
    record(
      "missing saved readiness and load remain unknown rather than becoming a score or 100 percent",
    );
  }
  {
    const { page, context } = await open("screen=readiness&scenario=empty");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText("No check-in yet today", { exact: true })).toBeVisible();
    const sleep = page.getByRole("slider", { name: "Hours of sleep", exact: true });
    await sleep.focus();
    await page.keyboard.press("ArrowRight");
    await expect(sleep).toHaveAttribute("aria-valuenow", "7.5");
    await page.getByRole("button", { name: "Calculate my load", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__core.counts.submitCheckin ?? 0)).toBe(1);
    await expect(page.getByText("Synthetic saved check-in advice.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.last.submitCheckin)).toMatchObject({
      sleepHours: 7.5,
      timeZone: "Europe/Vilnius",
    });
    await expect(page.locator(".fl-readiness-metrics .fl-workspace-number").first()).toHaveText(
      "61/ 100",
    );
    await page.reload();
    await expect(page.locator(".fl-readiness-metrics .fl-workspace-number").first()).toHaveText(
      "61/ 100",
    );
    await context.close();
    record(
      "keyboard check-in adjustment uses the production calculation, saves in the athlete timezone and survives reload",
    );
  }
  {
    const { page, context } = await open("screen=readiness&scenario=empty&fail=save-readiness");
    const save = page.getByRole("button", { name: "Calculate my load", exact: true });
    await save.click();
    await expect.poll(() => page.evaluate(() => window.__core.counts.submitCheckin)).toBe(1);
    await expect(save).toBeEnabled();
    await expect(page.getByText("No check-in yet today", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__core.checkin)).toBeNull();
    await context.close();
    record("failed readiness save leaves the day empty and the draft editable");
  }
  for (const screen of ["readiness", "workout"]) {
    const { page, context } = await open(
      `screen=${screen}&scenario=empty&shell=1&theme=light&lang=lt`,
      { width: 320, height: 844 },
    );
    await expect(page.locator(".fl-workspace h1")).toHaveCount(1);
    if (screen === "workout") {
      await page
        .getByRole("button", { name: "Pradėti arba tęsti treniruotę", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Registruoti setą", exact: true }),
      ).toBeVisible();
    } else await expect(page.getByRole("slider")).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await context.close();
    record(`${screen}: Lithuanian active form fits a 320px light viewport`);
  }
  await writeFile(
    path.join(artifacts, "session-design-review.json"),
    JSON.stringify({ syntheticFixture: true, captures }, null, 2) + "\n",
  );
}
