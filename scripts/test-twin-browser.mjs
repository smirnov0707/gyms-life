import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const artifacts = path.join(root, "test-results/twin");
await mkdir(artifacts, { recursive: true });
const results = [];
let server;
let browser;
let page;
const viewControls = async (target, open) => {
  const toggle = target.getByRole("button", { name: "View controls", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== String(open)) await toggle.click();
};
const preset = async (target, name) => {
  await viewControls(target, true);
  await target.getByRole("button", { name, exact: true }).click();
  await viewControls(target, false);
  // Closing controls can scroll the on-demand scene out of view. Sample its
  // camera only after it is visible and has painted the command.
  await target.locator("canvas").scrollIntoViewIfNeeded();
  await target.waitForTimeout(150);
};
const stopMotion = async (target) => {
  await viewControls(target, true);
  await target.getByLabel("Ambient motion", { exact: true }).uncheck();
  await viewControls(target, false);
};
const loaded = async (target) => {
  await target.goto("http://127.0.0.1:4179");
  await expect(target.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(async () => Number(await target.locator("canvas").getAttribute("data-twin-frames")))
    .toBeGreaterThan(0);
};
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/twin-browser"),
    publicDir: path.join(root, "public"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@/lib/digital-twin.functions",
          replacement: path.join(root, "tests/twin-browser/service-stub.ts"),
        },
        { find: "@", replacement: path.join(root, "src") },
      ],
    },
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
    server: { host: "127.0.0.1", port: 4179, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await loaded(page);
  await preset(page, "Front");
  await stopMotion(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(artifacts, "desktop-front.png"), fullPage: true });
  const canvas = page.locator("canvas");
  const visited = [];
  for (let step = 0; step < 16; step++) {
    await preset(page, "Rotate right");
    await page.waitForTimeout(60);
    visited.push(Number(await canvas.getAttribute("data-twin-yaw")));
  }
  console.log("Orbit samples", JSON.stringify(visited));
  await writeFile(path.join(artifacts, "orbit-samples.json"), JSON.stringify(visited));
  expect(visited.some((angle) => angle > 1)).toBe(true);
  expect(visited.some((angle) => angle < -1)).toBe(true);
  expect(Math.abs(Math.sin(visited.at(-1)))).toBeLessThan(0.05);
  record("full 360-degree horizontal orbit");

  await preset(page, "Reset view");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const x = box.x + box.width / 2 + 22;
  const y = box.y + box.height / 2 - box.height * 0.19;
  await page.mouse.click(x, y);
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  const beforeDrag = Number(await canvas.getAttribute("data-twin-yaw"));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 95, y + 6, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  expect(Number(await canvas.getAttribute("data-twin-yaw"))).not.toBe(beforeDrag);
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  record("mesh raycast selects chest; dragging does not select another region");

  const beforeZoom = Number(await canvas.getAttribute("data-twin-distance"));
  await preset(page, "Zoom in");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-twin-distance")))
    .toBeLessThan(beforeZoom);
  await canvas.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Number(await canvas.getAttribute("data-twin-yaw"))).not.toBe(0);
  record("zoom and keyboard camera controls");

  const evidence = page.getByRole("button", { name: "Why this estimate?", exact: true });
  await expect(evidence).toHaveAttribute("aria-expanded", "false");
  await evidence.click();
  await expect(page.getByText("1000 kg", { exact: true })).toBeVisible();
  await expect(page.getByText(/Wearable physiology is not included/)).toBeVisible();
  await evidence.click();
  await viewControls(page, true);
  await page.getByRole("button", { name: "Front", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  record("progressive evidence disclosure and Escape return focus without losing the scene");

  await page.getByLabel("Inspect a region", { exact: true }).selectOption("glutes");
  await expect(page.getByRole("heading", { name: "Glutes", exact: true })).toBeVisible();
  await expect(
    page.getByText("No sets logged for this region recently.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
  expect(await page.locator("select").textContent()).not.toContain("Fresh");
  record("unknown evidence stays unknown after selection and source updates");
  await page.getByRole("button", { name: "Restore evidence", exact: true }).click();

  await canvas.evaluate((element) =>
    element.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext(),
  );
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await expect(
    page.getByText("3D is unavailable on this device. Your evidence is still available in 2D.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try 3D again", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  record("real WebGL context loss, retry and manual 2D fallback");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await page.getByRole("button", { name: "Toggle Twin", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle Twin", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
  record("strict-mode mount/unmount cleanup without uncaught browser errors");
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  page = await mobile.newPage();
  await loaded(page);
  await preset(page, "Front");
  await stopMotion(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const regionHeading = page.locator("[data-twin-inspector] h2");
  const regionBox = await regionHeading.boundingBox();
  expect(regionBox.y + regionBox.height).toBeLessThan(844 - 96);
  const sceneBox = await page.locator("[data-twin-viewport]").boundingBox();
  expect(sceneBox.height).toBeGreaterThanOrEqual(240);
  const settingsBox = await page
    .getByRole("button", { name: "View controls", exact: true })
    .boundingBox();
  expect(settingsBox.width).toBeGreaterThanOrEqual(44);
  expect(settingsBox.height).toBeGreaterThanOrEqual(44);
  record(
    "mobile selected region is visible above a reserved 96px dock and controls have touch targets",
  );
  const mobileCanvas = page.locator("canvas");
  await mobileCanvas.scrollIntoViewIfNeeded();
  const mobileBox = await mobileCanvas.boundingBox();
  const center = {
    x: mobileBox.x + mobileBox.width / 2,
    y: mobileBox.y + mobileBox.height / 2,
  };
  const client = await mobile.newCDPSession(page);
  const distanceBeforePinch = Number(await mobileCanvas.getAttribute("data-twin-distance"));
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: center.x - 30, y: center.y, id: 1 },
      { x: center.x + 30, y: center.y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: center.x - 55, y: center.y, id: 1 },
      { x: center.x + 55, y: center.y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(async () => Number(await mobileCanvas.getAttribute("data-twin-distance")))
    .toBeLessThan(distanceBeforePinch);
  await preset(page, "Reset view");
  await page.screenshot({ path: path.join(artifacts, "mobile-front.png"), fullPage: true });
  await preset(page, "Back");
  await page.screenshot({ path: path.join(artifacts, "mobile-back.png"), fullPage: true });
  await preset(page, "Left side");
  await page.screenshot({ path: path.join(artifacts, "mobile-side.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  record("mobile two-finger zoom, front/back/side views and 320px layout");
  await page.goto("http://127.0.0.1:4179/?lang=lt");
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tavo skaitmeninis dvynys", exact: true }),
  ).toBeVisible();
  await page.getByText("Modelis ir duomenys", { exact: true }).click();
  await expect(page.getByText("TEST-FIXTURE-NOT-USER-DATA", { exact: true })).toBeVisible();
  await page.getByText("Modelis ir duomenys", { exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Vaizdo valdymas", exact: true }).click();
  await expect(page.getByLabel("Subtilus judesys", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  record(
    "Lithuanian 320px disclosure and doubled text remain accessible without horizontal overflow",
  );
  await mobile.close();

  const reduced = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  page = await reduced.newPage();
  await loaded(page);
  await page.waitForTimeout(1000);
  const frameCount = await page.locator("canvas").getAttribute("data-twin-frames");
  await page.waitForTimeout(350);
  expect(await page.locator("canvas").getAttribute("data-twin-frames")).toBe(frameCount);
  record("reduced motion keeps 3D interactive without continuous rendering");
  await reduced.close();

  const unsupported = await browser.newContext();
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === "webgl2" ? null : original.call(this, kind, ...args);
    };
  });
  page = await unsupported.newPage();
  await page.goto("http://127.0.0.1:4179");
  await expect(
    page.getByText("3D is unavailable on this device. Your evidence is still available in 2D.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel("Inspect a region", { exact: true })).toBeVisible();
  record("WebGL unavailable preserves an accessible 2D evidence surface");
  await unsupported.close();
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
  results.push({
    name: "browser failure",
    status: "failed",
    detail: error instanceof Error ? error.stack : String(error),
  });
  throw error;
} finally {
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close();
  await server?.close();
}
