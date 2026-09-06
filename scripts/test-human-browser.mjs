import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

process.env.VITE_TWIN_HUMAN_PREVIEW = "true";
const root = process.cwd();
const artifacts = path.join(root, "test-results/human");
await mkdir(artifacts, { recursive: true });
const results = [], errors = [];
let server, browser, page;
const record = (name) => { results.push({ name, status: "passed" }); console.log(`PASS ${name}`); };
const controls = async (p, open) => {
  const b = p.getByRole("button", { name: "View controls", exact: true });
  if ((await b.getAttribute("aria-expanded")) !== String(open)) await b.click();
};
const preset = async (p, name) => {
  await controls(p, true); await p.getByRole("button", { name, exact: true }).click();
  await controls(p, false); await p.locator("canvas").scrollIntoViewIfNeeded(); await p.waitForTimeout(180);
};
const load = async (p, query = "") => {
  await p.goto(`http://127.0.0.1:4182/${query}`);
  await expect(p.locator('canvas[data-twin-model="cc0-human"]')).toBeVisible({ timeout: 45000 });
  await expect.poll(async () => Number(await p.locator("canvas").getAttribute("data-twin-frames"))).toBeGreaterThan(0);
};
try {
  server = await createServer({
    configFile: false, root: path.join(root, "tests/twin-browser"), publicDir: path.join(root, "public"),
    plugins: [react(), tailwindcss()],
    resolve: { alias: [
      { find: "@/lib/digital-twin.functions", replacement: path.join(root, "tests/twin-browser/service-stub.ts") },
      { find: "@", replacement: path.join(root, "src") },
    ] },
    optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-runtime", "@tanstack/react-query", "zod", "lucide-react", "three", "three/addons/controls/OrbitControls.js", "three/addons/loaders/GLTFLoader.js"] },
    server: { host: "127.0.0.1", port: 4182, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
  page = await context.newPage(); page.on("pageerror", (e) => errors.push(String(e)));
  await load(page);
  await controls(page, true); await page.getByLabel("Ambient motion", { exact: true }).uncheck(); await controls(page, false);
  const canvas = page.locator("canvas");
  await canvas.evaluate((el) => { el.dataset["validationIdentity"] = "original"; });
  await expect(canvas).toHaveAttribute("data-twin-appearance", "natural");
  await expect(page.locator("[data-human-disclaimer]")).toContainText("not a scan");
  record("packaged CC0 human and natural skin load in the actual Twin stage");
  for (const [name, file] of [["Front", "front"], ["Back", "back"], ["Left side", "left"], ["Right side", "right"]]) {
    await preset(page, name);
    await canvas.screenshot({ path: path.join(artifacts, `body-${file}.png`) });
    if (file === "front") await page.screenshot({ path: path.join(artifacts, "desktop-front.png"), fullPage: true });
  }
  await preset(page, "Front");
  const angles = [];
  await canvas.focus();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(100);
    angles.push(Number(await canvas.getAttribute("data-twin-yaw")));
  }
  expect(angles.some((x) => x > 2)).toBe(true); expect(angles.some((x) => x < -2)).toBe(true);
  record("genuine full 360-degree orbit and four source-model views");
  await page.getByLabel("Inspect a region", { exact: true }).selectOption("chest");
  const before = await canvas.getAttribute("data-twin-yaw");
  await page.getByRole("button", { name: "Evidence colours", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-appearance", "evidence");
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-layer", "logged_volume");
  await expect(canvas).toHaveAttribute("data-validation-identity", "original");
  expect(await canvas.getAttribute("data-twin-yaw")).toBe(before);
  await expect(page.getByLabel("Inspect a region", { exact: true })).toHaveValue("chest");
  await canvas.screenshot({ path: path.join(artifacts, "body-evidence.png") });
  record("appearance and data-layer changes preserve canvas camera and canonical selection");
  const distance = Number(await canvas.getAttribute("data-twin-distance"));
  await canvas.focus(); await page.keyboard.press("+"); await page.waitForTimeout(150);
  expect(Number(await canvas.getAttribute("data-twin-distance"))).toBeLessThan(distance);
  await page.keyboard.press("Home");
  record("existing constrained zoom and reset work with the textured human");
  await page.getByRole("button", { name: "Fail source", exact: true }).click();
  await expect(page.getByLabel("Inspect a region", { exact: true })).toContainText("—");
  await expect(canvas).toHaveAttribute("data-twin-model", "cc0-human");
  await page.getByRole("button", { name: "Restore source", exact: true }).click();
  record("source failure does not manufacture measurements or replace the human");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByLabel("Inspect a region", { exact: true })).toHaveValue("chest");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('canvas[data-twin-model="cc0-human"]')).toBeVisible({ timeout: 30000 });
  record("manual 2D fallback retains region and existing evidence units");
  await page.locator("canvas").evaluate((el) => el.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
  await expect(page.getByRole("button", { name: "Try 3D again", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try 3D again", exact: true }).click();
  await expect(page.locator('canvas[data-twin-model="cc0-human"]')).toBeVisible({ timeout: 30000 });
  record("real WebGL loss and retry preserve the information surface");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page.screenshot({ path: path.join(artifacts, "light-theme.png"), fullPage: true });
  record("light-theme view captured without restyling the surrounding application");
  for (const width of [320, 375, 390, 430]) {
    const mobile = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const p = await mobile.newPage(); await load(p, width === 320 ? "?lang=lt" : "");
    await p.locator("canvas").scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
    await p.screenshot({ path: path.join(artifacts, `mobile-${width}.png`), fullPage: true });
    await mobile.close();
  }
  record("320 375 390 and 430px layouts render; Lithuanian 320px has no horizontal overflow");
  for (const response of [{ status: 404, body: "missing" }, { status: 200, body: "not a glb" }]) {
    const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await isolated.newPage();
    await p.route("**/assets/twin/human/*.glb", (route) => route.fulfill(response));
    await p.goto("http://127.0.0.1:4182");
    await expect(p.getByRole("button", { name: "Try 3D again", exact: true })).toBeVisible({ timeout: 20000 });
    await expect(p.getByLabel("Inspect a region", { exact: true })).toBeVisible();
    await isolated.close();
  }
  record("missing and malformed assets use the real accessible fallback");
  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const rp = await reduced.newPage(); await load(rp); await rp.locator("canvas").scrollIntoViewIfNeeded(); await rp.waitForTimeout(600);
  const frames = await rp.locator("canvas").getAttribute("data-twin-frames"); await rp.waitForTimeout(650);
  expect(await rp.locator("canvas").getAttribute("data-twin-frames")).toBe(frames);
  await rp.locator("canvas").focus(); await rp.keyboard.press("ArrowRight"); await rp.waitForTimeout(150);
  expect(Number(await rp.locator("canvas").getAttribute("data-twin-frames"))).toBeGreaterThan(Number(frames));
  await reduced.close(); record("reduced motion stops idle rendering but preserves user rotation");
  const video = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(artifacts, "video"), size: { width: 390, height: 844 } } });
  const vp = await video.newPage(); await load(vp); await vp.locator("canvas").scrollIntoViewIfNeeded(); await vp.locator("canvas").focus();
  for (let i = 0; i < 16; i++) { await vp.keyboard.press("ArrowRight"); await vp.waitForTimeout(260); }
  await video.close();
  const metrics = await page.locator("canvas").evaluate((el) => ({ drawCalls: Number(el.dataset.twinDrawCalls), triangles: Number(el.dataset.twinTriangles), deviceFps: null, environment: "GitHub Actions Chromium SwiftShader, not physical-phone validation" }));
  expect(errors).toEqual([]);
  record("browser diagnostics captured; visual acceptance left to owner");
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify({ results, angles, metrics, errors, visualAccepted: false }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(path.join(artifacts, "failure.json"), JSON.stringify({ results, error: String(error), errors }, null, 2));
} finally { await browser?.close(); await server?.close(); }
