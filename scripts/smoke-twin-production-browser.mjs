import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, webkit, expect } from "@playwright/test";

// Public, read-only check against the deployed app: no fixtures, authentication,
// request interception or CSP overrides. HTTP 200 alone missed blocked textures.
const origin = process.env.GYMSLIFE_ORIGIN ?? "https://gyms.life";
const engine = process.env.TWIN_BROWSER_ENGINE ?? "chromium";
assert(["chromium", "webkit"].includes(engine));
const out = path.resolve(`test-results/twin-production-${engine}`);
await mkdir(out, { recursive: true });
const assetSha256 = createHash("sha256")
  .update(await readFile("public/models/twin-natural-skin-v1.glb"))
  .digest("hex");
const browser = await (engine === "webkit" ? webkit : chromium).launch(
  engine === "chromium"
    ? {
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {}),
        args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      }
    : {},
);
const errors = [];
const browserNotices = [];
let report = { engine, origin, ok: false };
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    // WebKit reports an ignored Chromium-only keyboard-resize hint as an
    // error. Retain that exact browser notice; all app/CSP/texture errors fail.
    if (
      engine === "webkit" &&
      message.text() === 'Viewport argument key "interactive-widget" not recognized and ignored.'
    ) {
      browserNotices.push(message.text());
      return;
    }
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.equal(response.status(), 200);
  assert(response.headers()["content-security-policy"], "Live SSR must send its CSP");
  const stage = page.locator("#digital-twin [data-twin-stage]");
  const canvas = stage.locator("canvas");
  // Hydration replaces the SSR placeholder while the lazy Twin is loading.
  // Re-resolve that section through the transition, but keep the loaded-human
  // assertion: a stable fallback must still fail this check.
  await expect(async () => {
    await page.locator("#digital-twin").scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 1500 });
  }).toPass({ timeout: 45000, intervals: [500, 1000] });
  await expect(canvas).toHaveAttribute("data-twin-asset-sha256", assetSha256);
  await expect(canvas).toBeVisible();
  const breath = async () => Number(await canvas.getAttribute("data-twin-breath"));
  await expect.poll(breath, { timeout: 8000, intervals: [60] }).toBeGreaterThan(0.9);
  await stage.screenshot({ path: path.join(out, "twin-live.png") });
  await expect.poll(breath, { timeout: 8000, intervals: [60] }).toBeLessThan(0.1);
  expect(errors).toEqual([]);
  report = { ...report, ok: true, assetSha256, breathing: "passed" };
  console.log("PASS deployed textured human and breathing", JSON.stringify(report));
} catch (error) {
  await page?.screenshot({ path: path.join(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ ...report, errors, browserNotices }, null, 2),
  );
  await browser.close();
}
