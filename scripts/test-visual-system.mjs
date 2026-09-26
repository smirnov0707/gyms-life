import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((part) => parseInt(part, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected an opaque theme token: ${hex}`);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/** Actual routes + shared controls; assertions cover readability and input access,
 * rather than pinning incidental CSS declarations or weakening layout gates. */
export async function reviewVisualSystem({ openPanel, artifacts, record }) {
  const evidence = [];
  for (const test of [
    { screen: "today", theme: "light", width: 1440, height: 1000 },
    { screen: "lab", theme: "light", width: 390, height: 844 },
    { screen: "twin", theme: "light", width: 390, height: 844 },
    { screen: "coach", theme: "light", width: 390, height: 844 },
    { screen: "coach", theme: "dark", width: 1440, height: 1000 },
  ]) {
    const { page, errors } = await openPanel(
      `?shell=1&screen=${test.screen}&scenario=reference&theme=${test.theme}`,
      {
        viewport: { width: test.width, height: test.height },
        locale: "en-US",
        reducedMotion: "reduce",
      },
    );
    await expect(page.locator("html")).toHaveClass(test.theme);
    await expect(page.locator(".fl-shell-header")).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.load('500 16px "Manrope"', "Ąžuolas Žygis");
      await document.fonts.load('500 16px "Space Grotesk"', "Ąžuolas Žygis");
      await document.fonts.ready;
    });
    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        [
          "foreground",
          "muted-foreground",
          "surface",
          "background",
          "primary",
          "primary-foreground",
          "action-start",
          "action-end",
        ].map((name) => [name, styles.getPropertyValue(`--${name}`).trim()]),
      );
    });
    const ratios = {};
    for (const [foreground, background] of [
      ["foreground", "surface"],
      ["muted-foreground", "surface"],
      ["muted-foreground", "background"],
      ["primary", "surface"],
      ["primary-foreground", "action-start"],
      ["primary-foreground", "action-end"],
    ]) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      ratios[`${foreground}/${background}`] = Number(ratio.toFixed(2));
      expect(
        ratio,
        `${test.theme} ${foreground}/${background} normal text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    const fonts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => /\.(ttf|woff2?)(\?|$)/.test(name)),
    );
    expect(fonts).toHaveLength(2);
    for (const font of fonts) expect(new URL(font).origin).toBe(new URL(page.url()).origin);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.locator("#main-content").blur();
    if (test.screen === "coach") {
      const composer = page.locator(".fl-coach-conversation form input");
      const send = page.locator(".fl-coach-conversation form button");
      await expect(send).toBeDisabled();
      await composer.fill("Explain my training signals");
      await expect(send).toBeEnabled();
      expect((await send.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await composer.fill("");
      await expect(send).toBeDisabled();
      const duration = await page
        .locator(".fl-page-enter")
        .evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
      expect(duration).toBeLessThanOrEqual(0.01);
    }
    if (test.screen === "twin") {
      await expect(page.locator("canvas[data-twin-frames]").first()).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator("canvas[data-twin-frames]")
            .first()
            .getAttribute("data-twin-frames")
            .then(Number),
        )
        .toBeGreaterThan(2);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: path.join(artifacts, `design-${test.screen}-${test.theme}-${test.width}.png`),
    });
    if (test.screen === "lab") {
      await page.getByRole("button", { name: "Do now", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("dialog").getByText("Start workout", { exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: path.join(artifacts, "design-actions-light-390.png") });
    }
    expect(errors).toEqual([]);
    evidence.push({ ...test, fonts, ratios });
    await page.context().close();
  }
  await writeFile(
    path.join(artifacts, "design-system-audit.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log("DESIGN_SYSTEM_AUDIT " + JSON.stringify(evidence));
  record(
    "Shared design system loads local fonts, passes text-token contrast, keyboard access and reduced-motion checks in both themes",
  );
}
