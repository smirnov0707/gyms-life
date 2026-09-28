import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

async function bodyStep(page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resistance bands", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#w")).toHaveValue("68");
}

export async function verifyIntakeDesign({ open, record, artifacts }) {
  const captures = [];
  for (const screen of ["intake-goal", "intake-body", "intake-result", "library", "movement"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 390]) {
        const route = screen.startsWith("intake")
          ? "onboarding"
          : screen === "library"
            ? "exercises"
            : "movement";
        const { page, context } = await open(`screen=${route}&shell=1&theme=${theme}`, {
          width,
          height: width === 390 ? 844 : 1000,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const workspace = page.locator(".fl-workspace");
        await expect(workspace.locator("h1")).toHaveCount(1);
        if (screen === "intake-body" || screen === "intake-result") await bodyStep(page);
        if (screen === "intake-result") {
          await page.getByRole("button", { name: "Generate plan", exact: true }).click();
          await expect(workspace.locator("h1")).toHaveText("Synthetic training programme");
          await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10000 });
        }
        if (screen === "intake-body") {
          await expect(page.locator("#w")).toHaveAttribute("inputmode", "decimal");
          await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
        }
        if (screen === "library") {
          await expect(page.locator(".fl-library-card")).toHaveCount(6);
          // Verify actual local media, including below-the-fold lazy posters.
          for (const img of await page.locator(".fl-library-media img").all()) {
            await img.scrollIntoViewIfNeeded();
            await expect
              .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
              .toBe(true);
          }
          await expect(page.locator(".fl-library-builder")).not.toHaveAttribute("open", "");
        }
        if (screen === "movement") {
          await expect(workspace.locator("h1")).toHaveText("Bench press");
          await expect(page.locator(".fl-movement-steps li")).toHaveCount(3);
          await expect(page.locator("video")).toHaveAttribute("controls", "");
          await expect
            .poll(() => page.locator("video").evaluate((el) => el.readyState))
            .toBeGreaterThanOrEqual(2);
          expect(await page.locator("video").evaluate((el) => el.paused)).toBe(true);
          await expect(workspace).not.toContainText("AI OPTIMIZED");
          await expect(workspace).not.toContainText("VECT:");
        }
        await page.evaluate(() => document.fonts.ready);
        const audit = await workspace.evaluate((el) => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          nestedMain: document.querySelectorAll("main main").length,
          titleFont: getComputedStyle(el.querySelector("h1")).fontFamily,
          tinyButtons: [...el.querySelectorAll("button")]
            .filter(
              (button) =>
                button.getBoundingClientRect().height > 0 &&
                button.getBoundingClientRect().height < 43,
            )
            .map((button) => button.textContent),
        }));
        expect(audit.overflow).toBe(false);
        expect(audit.nestedMain).toBe(0);
        expect(audit.titleFont).toContain("Space Grotesk");
        expect(audit.tinyButtons).toEqual([]);
        if (screen === "intake-result") {
          const size = await page
            .locator(".fl-intake-prescription")
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
          expect(size).toBeLessThanOrEqual(20);
        }
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        if (screen === "intake-goal" && width === 390) {
          const geometry = await page.evaluate(() => ({
            actionBottom: document.querySelector(".fl-intake-navigation").getBoundingClientRect()
              .bottom,
            dockTop: document.querySelector(".fl-mobile-navigation").getBoundingClientRect().top,
          }));
          expect(geometry.actionBottom).toBeLessThan(geometry.dockTop);
        }
        const name = `intake-${screen}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, `${name}.png`),
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
          syntheticFixture: true,
          audit,
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("INTAKE_UI_BEGIN " + JSON.stringify(capture));
          const encoded = png.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("INTAKE_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("INTAKE_UI_END " + name);
        }
        await context.close();
        record(
          `${screen}: ${theme} ${width}px real shell, typography, touch targets and visual capture`,
        );
      }
    }
  }
  {
    const { page, context } = await open("screen=exercises&fail=exercises-pending");
    await expect(page.locator(".fl-library-state[role=status]")).toBeVisible();
    await expect(page.locator(".fl-library-count")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = "exercises";
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".fl-library-count")).toHaveCount(0);
    await expect(page.locator(".fl-library-card")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await page.getByRole("alert").getByRole("button").click();
    await expect(page.locator(".fl-library-card")).toHaveCount(6);
    await context.close();
    record(
      "catalogue loading and failure never claim zero results; retry restores real catalogue rows",
    );
  }
  {
    const { page, context } = await open("screen=exercises");
    await expect(page.locator(".fl-library-card")).toHaveCount(6);
    const search = page.getByRole("searchbox");
    await search.fill("bench");
    await expect(page.locator(".fl-library-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Add to favorites: Bench press", exact: true }).click();
    await search.fill("");
    await page.locator(".fl-library-favorites").click();
    await expect(page.locator(".fl-library-card")).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Remove from favorites: Bench press", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page
      .locator("#exercise-filters")
      .getByRole("button", { name: "Chest", exact: true })
      .click();
    await expect(page.locator(".fl-library-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Remove filter: Chest", exact: true }).click();
    await expect(page.locator(".fl-library-card")).toHaveCount(6);
    await page.locator(".fl-library-card").first().getByRole("link").click();
    await expect(page.locator(".fl-movement-workspace h1")).toHaveText("Bench press");
    await context.close();
    record(
      "catalogue search, favourite persistence, semantic filter chips and exercise navigation work",
    );
  }
  {
    const { page, context } = await open("screen=exercises");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const card = page
      .locator(".fl-library-card")
      .filter({ has: page.getByRole("heading", { name: "Triceps pushdown", exact: true }) });
    await card.getByRole("button").last().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Frame 1", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await dialog.getByRole("button", { name: "Frame 2", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.locator("img")).toHaveAttribute("src", /\/1\.jpg$/);
    await expect(dialog.getByRole("button", { name: "Play demonstration" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(card.getByRole("button").last()).toBeFocused();
    await context.close();
    record(
      "quick preview has keyboard frame controls, defaults to a still and restores focus on close",
    );
  }
  {
    const { page, context } = await open("screen=onboarding");
    await page.getByRole("button", { name: /^Full/ }).click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
    for (let step = 1; step <= 5; step++) {
      await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(step));
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(page.getByRole("textbox")).toHaveValue("Existing synthetic restriction");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator("#w").fill("");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Generate plan", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Synthetic training programme");
    expect(await page.evaluate(() => window.__core.last.generatePlan.weightKg)).toBeNull();
    await context.close();
    record(
      "full six-step intake retains existing restrictions and submits blank body measurements as unknown",
    );
  }
  for (const screen of ["onboarding", "exercises", "movement"]) {
    const { page, context } = await open(`screen=${screen}&lang=lt&theme=light&shell=1`, {
      width: 320,
      height: 844,
    });
    await expect(page.locator(".fl-workspace h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    await context.close();
    record(`${screen}: Lithuanian copy fits the light theme at 320px`);
  }
  await writeFile(
    path.join(artifacts, "intake-design-review.json"),
    JSON.stringify({ captures }, null, 2),
  );
}
