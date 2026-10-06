import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Real contextual routes and their actual shell; synthetic service boundaries only. */
export async function verifyCoreDesign({ open, record, artifacts }) {
  const captures = [];
  for (const screen of ["training", "nutrition", "profile", "meals"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 390]) {
        const { page, context } = await open(`screen=${screen}&theme=${theme}&shell=1`, {
          width,
          height: width === 390 ? 844 : 1000,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const workspace = page.locator(".fl-workspace");
        await expect(workspace.locator("h1:visible")).toHaveCount(1);
        if (screen === "training")
          await expect(
            page.getByRole("heading", { name: "Synthetic training programme" }),
          ).toBeVisible();
        if (screen === "nutrition")
          await expect(page.locator(".fl-nutrition-metric").first()).toContainText("500");
        if (screen === "meals")
          await expect(
            page.getByRole("heading", { name: "Synthetic seven-day meal plan" }),
          ).toBeVisible();
        if (screen === "profile") {
          const identity = page
            .locator("details.fl-profile-section")
            .filter({ hasText: "Identity & body" });
          const memory = page
            .locator("details.fl-profile-section")
            .filter({ hasText: "Memory & privacy" });
          if ((await identity.getAttribute("open")) === null)
            await identity.locator(":scope > summary").click();
          if ((await memory.getAttribute("open")) === null)
            await memory.locator(":scope > summary").click();
          const preference = page.getByText("Synthetic preference: train in the morning.", {
            exact: true,
          });
          const memoryEntry = preference.locator("xpath=ancestor::details[1]");
          if ((await memoryEntry.getAttribute("open")) === null)
            await memoryEntry.locator(":scope > summary").click();
          await expect(preference).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        const audit = await workspace.evaluate((el) => {
          const root = getComputedStyle(document.documentElement);
          const rgba = (value) => {
            const ctx = document.createElement("canvas").getContext("2d");
            ctx.fillStyle = value;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v / 255);
          };
          const lum = (rgb) =>
            rgb
              .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
              .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
          const contrast = (a, b) =>
            (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
          const surface = rgba(root.getPropertyValue("--surface"));
          const primary = rgba(root.getPropertyValue("--primary"));
          const heroTint = surface.map((v, i) => v * 0.92 + primary[i] * 0.08);
          const samples = [
            ...el.querySelectorAll(
              ".fl-workspace-title,.fl-workspace-number,.fl-metric-label,.fl-workspace-eyebrow,.fl-profile-memory summary span",
            ),
          ]
            .filter((node) => node.getClientRects().length)
            .map((node) => {
              const color = rgba(getComputedStyle(node).color);
              return {
                text: node.textContent,
                minContrast: Math.min(contrast(color, surface), contrast(color, heroTint)),
              };
            });
          return {
            samples,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            fonts: [...document.fonts]
              .filter((font) => font.status === "loaded")
              .map((font) => font.family),
            titleFont: getComputedStyle(el.querySelector("h1")).fontFamily,
          };
        });
        expect(audit.overflow).toBe(false);
        expect(audit.titleFont).toContain("Space Grotesk");
        expect(audit.fonts.some((name) => name.includes("Manrope"))).toBe(true);
        expect(audit.fonts.some((name) => name.includes("Space Grotesk"))).toBe(true);
        for (const sample of audit.samples)
          expect(sample.minContrast, `${screen} ${theme} ${sample.text}`).toBeGreaterThanOrEqual(
            4.5,
          );
        if (screen === "nutrition") {
          await expect(
            page
              .getByRole("link", { name: "Today", exact: true })
              .filter({ has: page.locator("svg") })
              .last(),
          ).toHaveAttribute("aria-current", "page");
          const input = page.getByRole("textbox", { name: "Log what you ate" });
          await input.fill("Synthetic lunch");
          const add = page.locator(".fl-meal-entry button");
          await expect(add).toBeEnabled();
          expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(44);
          await input.fill("");
          await expect(add).toBeDisabled();
        }
        if (screen === "profile") {
          const identity = page
            .locator("details.fl-profile-section")
            .filter({ hasText: "Identity & body" });
          if ((await identity.getAttribute("open")) === null)
            await identity.locator(":scope > summary").click();
          await expect(page.getByRole("spinbutton", { name: "Height (cm)" })).toHaveValue("170");
          if (width === 1440) {
            const body = await page.locator(".fl-profile-body").boundingBox();
            const memory = await page.locator(".fl-profile-memory").boundingBox();
            expect(Math.abs(body.y - memory.y)).toBeLessThan(4);
            expect(memory.x).toBeGreaterThanOrEqual(body.x + body.width);
          }
        }
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        if (width === 390 && (screen === "nutrition" || screen === "training")) {
          const action =
            screen === "nutrition"
              ? page.locator(".fl-meal-entry button")
              : page.locator(".fl-plan-next > a");
          const box = await action.boundingBox();
          const dock = await page.locator(".fl-mobile-navigation").boundingBox();
          expect(box.y + box.height).toBeLessThan(dock.y);
        }
        const name = `context-${screen}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, `${name}.png`),
          animations: "disabled",
        });
        captures.push({
          name,
          screen,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
          syntheticFixture: true,
          audit,
        });
        await context.close();
        record(
          `${screen}: ${theme} ${width}px shell, local fonts, rendered text contrast and visual capture`,
        );
      }
    }
  }
  for (const screen of ["training", "nutrition", "profile", "meals"]) {
    const { page, context } = await open(`screen=${screen}&lang=lt&theme=light&shell=1`, {
      width: 320,
      height: 844,
    });
    await expect(page.locator(".fl-workspace h1:visible")).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await context.close();
    record(`${screen}: Lithuanian light theme at 320px does not overflow`);
  }
  // Native disclosures must remain operable with a keyboard after the styling change.
  {
    const { page, context } = await open("screen=training&shell=1&theme=light");
    const summary = page.locator("summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Synthetic session 1", { exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Synthetic session 1", { exact: true })).not.toBeVisible();
    await context.close();
    record("training strategy disclosure opens and closes using the keyboard");
  }
  await writeFile(
    path.join(artifacts, "context-design-review.json"),
    JSON.stringify({ syntheticFixture: true, captures }, null, 2) + "\n",
  );
}
