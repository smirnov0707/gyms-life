import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = process.cwd();
const artifacts = path.join(root, "test-results/body-replay");
await mkdir(artifacts, { recursive: true });
const results = [];
const errors = [];
let server;
let browser;
let page;
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};
const controls = async (open) => {
  const button = page.getByRole("button", { name: "View controls", exact: true });
  if ((await button.getAttribute("aria-expanded")) !== String(open)) await button.click();
};
const preset = async (name) => {
  await controls(true);
  await page.getByRole("button", { name, exact: true }).click();
  await controls(false);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
};
const ready = async (lang = "en") => {
  await page.goto(`http://127.0.0.1:4181/?lang=${lang}`);
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await page.locator("canvas").getAttribute("data-twin-frames")))
    .toBeGreaterThan(0);
};
const inspect = () => page.locator("[data-replay-value]");
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/body-replay-browser"),
    publicDir: path.join(root, "public"),
    plugins: [react(), tailwindcss()],
    resolve: { alias: [{ find: "@", replacement: path.join(root, "src") }] },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react",
        "react-dom/client",
        "react/jsx-runtime",
        "@tanstack/react-query",
        "zod",
        "lucide-react",
        "three",
        "three/addons/controls/OrbitControls.js",
      ],
    },
    server: { host: "127.0.0.1", port: 4181, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await desktop.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await ready();
  await expect(inspect()).toHaveText("2 sets");
  await controls(true);
  await page.getByLabel("Ambient motion", { exact: true }).uncheck();
  await controls(false);
  await preset("Front");
  await page.screenshot({ path: path.join(artifacts, "desktop-sets.png"), fullPage: true });
  await preset("Right side");
  await preset("Zoom in");
  const canvas = page.locator("canvas");
  const pose = await canvas.evaluate((node) => {
    window.__replayCanvas = node;
    return [node.dataset.twinYaw, node.dataset.twinDistance];
  });
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(inspect()).toHaveText("800 kg × reps");
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-twin-layer", "session_volume");
  expect(await canvas.evaluate((node) => node === window.__replayCanvas)).toBe(true);
  expect(
    await canvas.evaluate((node) => [node.dataset.twinYaw, node.dataset.twinDistance]),
  ).toEqual(pose);
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  record("layer switch updates quantities without remounting canvas or resetting camera/selection");
  await preset("Front");
  await page.screenshot({ path: path.join(artifacts, "desktop-volume.png"), fullPage: true });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await expect(
    page.getByLabel("Inspect a region", { exact: true }).locator('option[value="chest"]'),
  ).toContainText("800 kg × reps");
  await expect(inspect()).toHaveText("800 kg × reps");
  await page.getByRole("button", { name: "Completed sets", exact: true }).click();
  await expect(inspect()).toHaveText("2 sets");
  await expect(
    page.getByLabel("Inspect a region", { exact: true }).locator('option[value="chest"]'),
  ).toContainText("2 sets");
  record("2D fallback and accessible selector retain layer-specific values and units");

  await page.getByRole("button", { name: "Incomplete inputs", exact: true }).click();
  await expect(inspect()).toHaveText("3 sets");
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(inspect()).toHaveText("—");
  await expect(page.locator('[data-replay-region="legs"]')).toContainText("800 kg × reps");
  await page.getByRole("button", { name: "Restore inputs", exact: true }).click();
  await expect(inspect()).toHaveText("800 kg × reps");
  await page.getByRole("button", { name: "Completed sets", exact: true }).click();
  await page.locator('[data-replay-region="__unassigned__"]').click();
  await expect(inspect()).toHaveText("1 set");
  await expect(page.getByLabel("Inspect a region", { exact: true })).toHaveValue("");
  await page.locator('[data-replay-region="chest"]').click();
  await page.getByRole("button", { name: "Fail catalogue", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("exercise catalogue is unavailable");
  await expect(inspect()).toHaveText("—");
  await expect(page.locator('[data-replay-region="__unassigned__"]')).toContainText("5 sets");
  await page.getByRole("button", { name: "Restore catalogue", exact: true }).click();
  await expect(inspect()).toHaveText("2 sets");
  await page.getByRole("button", { name: "Clear records", exact: true }).click();
  await expect(inspect()).toHaveText("—");
  await expect(page.locator("[data-body-replay]")).toContainText(
    "No completed set records in this response.",
  );
  await page.getByRole("button", { name: "Restore records", exact: true }).click();
  record(
    "incomplete inputs, unmapped sets, source failure and empty evidence stay distinct and reversible",
  );

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  const lost = await page.locator("canvas").evaluate((node) => {
    const extension = node.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(lost).toBe(true);
  await expect(page.getByRole("button", { name: "Try 3D again", exact: true })).toBeVisible();
  await expect(inspect()).toHaveText("800 kg × reps");
  await page.getByRole("button", { name: "Try 3D again", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("data-twin-layer", "session_volume");
  await controls(true);
  await page.getByRole("button", { name: "Front", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  record("actual WebGL context loss, retry and Escape focus preserve session evidence");
  await page.locator("canvas").evaluate((node) => {
    window.__removedReplayCanvas = node;
  });
  await page.getByRole("button", { name: "Toggle replay", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  const stopped = await page.evaluate(() => window.__removedReplayCanvas.dataset.twinFrames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__removedReplayCanvas.dataset.twinFrames)).toBe(stopped);
  await page.getByRole("button", { name: "Toggle replay", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  record("StrictMode remount leaves one canvas and stops disposed renderer frames");
  await page.getByRole("button", { name: "Fail replay source", exact: true }).click();
  await expect(page.locator("[data-replay-source-unavailable]")).toContainText(
    "Your workout is saved",
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(inspect()).toHaveCount(0);
  await expect(page.locator("[data-body-replay]")).not.toContainText("No completed set records");
  await page.getByRole("button", { name: "Retry replay", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await expect(inspect()).toHaveText("2 sets");
  record(
    "failed replay source preserves saved-workout wording, withholds stale quantities and supports explicit retry",
  );
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await expect(page.locator('[data-replay-region="chest"]')).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "light-theme.png"), fullPage: true });
  record("light-theme session list and inspector remain present with semantic theme tokens");
  await desktop.close();

  for (const [language, width] of [
    ["en", 390],
    ["lt", 320],
  ]) {
    const mobile = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    page = await mobile.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await ready(language);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    const layerName = language === "lt" ? "Registruotas tūris" : "Logged volume";
    const layerButton = page.getByRole("button", { name: layerName, exact: true });
    const target = await layerButton.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: path.join(artifacts, `mobile-${language}-sets.png`),
      fullPage: true,
    });
    await layerButton.click();
    await expect(inspect()).toContainText("800 kg");
    await page.locator("canvas").scrollIntoViewIfNeeded();
    const box = await page.locator("canvas").boundingBox();
    const before = Number(await page.locator("canvas").getAttribute("data-twin-distance"));
    const cdp = await mobile.newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const points = (distance) => [
      { x: x - distance, y, id: 1 },
      { x: x + distance, y, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(25) });
    for (const distance of [30, 35, 40, 45])
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(distance),
      });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect
      .poll(async () => Number(await page.locator("canvas").getAttribute("data-twin-distance")))
      .toBeLessThan(before);
    await page.screenshot({
      path: path.join(artifacts, `mobile-${language}-volume.png`),
      fullPage: true,
    });
    // Enlarged text must reflow, not turn controls into horizontal scrolling.
    await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.locator("[data-scroll-target]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-scroll-target]")).toBeVisible();
    record(
      `${language} mobile ${width}px: layer values, 44px targets, touch pinch, enlarged-text reflow and page scroll`,
    );
    await mobile.close();
  }
  const unsupported = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return String(type).startsWith("webgl") ? null : original.call(this, type, ...args);
    };
  });
  page = await unsupported.newPage();
  await page.goto("http://127.0.0.1:4181");
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(inspect()).toHaveText("800 kg × reps");
  record("unsupported WebGL keeps an accessible 2D session with correct volume units");
  await unsupported.close();
  expect(errors).toEqual([]);
} catch (error) {
  results.push({ name: "browser validation", status: "failed", error: String(error) });
  console.error(error);
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify({ synthetic: true, results, errors }, null, 2),
  );
  await browser?.close();
  await server?.close();
}
