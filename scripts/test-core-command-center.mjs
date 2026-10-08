import { expect } from "@playwright/test";
import path from "node:path";

/** Real shared shell, isolated account/services; opening a command is navigation, never a write. */
export async function verifyCommandCenter({ open, record, artifacts }) {
  for (const [lang, theme] of [
    ["lt", "light"],
    ["en", "dark"],
    ["de", "light"],
  ]) {
    const { page, context } = await open(`screen=training&shell=1&lang=${lang}&theme=${theme}`, {
      width: 320,
      height: 844,
    });
    const lt = lang === "lt";
    const trigger = page.getByRole("button", { name: lt ? "Daryti dabar" : "Do now", exact: true });
    await trigger.click();
    const drawer = page.locator("[data-command-center]");
    await expect(drawer).toBeVisible();
    const input = drawer.getByRole("textbox", { name: lt ? "Rasti veiksmą" : "Find an action" });
    await expect(drawer.locator(".fl-action-tile")).toHaveCount(3);
    await input.fill("dvynys");
    await expect(drawer.locator("[data-command-result]")).toHaveCount(1);
    await expect(drawer.getByRole("link", { name: "MY TWIN", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    const bounds = await input.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: path.join(artifacts, `command-center-${lang}-${theme}-320.png`),
      fullPage: true,
    });
    await input.press("ArrowDown");
    await expect(drawer.getByRole("link", { name: "MY TWIN", exact: true })).toBeFocused();
    await drawer.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(drawer.getByRole("textbox")).toHaveValue("");
    await context.close();
    record(`Command center ${lang}/${theme}: local search, 320px, arrows, Escape and reset`);
  }
  {
    const { page, context } = await open("screen=training&shell=1&lang=en", {
      width: 1280,
      height: 900,
    });
    const trigger = page.getByRole("button", { name: "Do now", exact: true });
    await trigger.focus();
    await page.keyboard.press("Control+k");
    const drawer = page.locator("[data-command-center]");
    const input = drawer.getByRole("textbox", { name: "Find an action" });
    await expect(input).toBeFocused();
    await input.fill("nothing-matches-this");
    await expect(drawer.getByRole("status")).toHaveText(
      "No matching action. Try a different word.",
    );
    await expect(drawer.locator("[data-command-result]")).toHaveCount(0);
    await input.press("ArrowDown");
    await expect(input).toBeFocused();
    await input.fill("camera");
    await input.press("ArrowUp");
    await expect(drawer.locator("[data-command-result]")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/screen=camera/);
    await context.close();
    record(
      "Command center: Control K focuses search; empty results stay usable; Enter opens the existing tool",
    );
  }
  {
    const { page, context } = await open("screen=training&shell=1&lang=en", {
      width: 1280,
      height: 900,
    });
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("textbox", { name: "Find an action" })).toBeFocused();
    await page.keyboard.press("Meta+k");
    await expect(page.locator("[data-command-center]")).toHaveCount(0);
    await page.keyboard.press("Control+Alt+k");
    await expect(page.locator("[data-command-center]")).toHaveCount(0);
    await context.close();
    record("Command center: Command K toggles once; AltGr-like modifiers are not captured");
  }
}
