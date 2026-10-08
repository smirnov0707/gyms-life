import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";

const root = process.cwd();
const out = path.join(root, "test-results/twin-skin");
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
let server;
let browser;

async function pixels(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let skin = 0, blue = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 90 && g > 55 && b > 35 && r > g * 1.07 && g > b * 1.03) skin++;
    if (b > 110 && g > 85 && b > r * 1.25 && g > r * 1.15) blue++;
  }
  return { skin, blue, width: info.width, height: info.height };
}
async function control(page, name) {
  const toggle = page.getByRole("button", { name: /^(View controls|Vaizdo valdymas)$/ });
  await toggle.click();
  await page.getByRole("button", { name, exact: true }).click();
  await toggle.click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
}
async function shot(page, name) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const buffer = await canvas.screenshot({ path: path.join(out, `${name}.png`), animations: "disabled", timeout: 30000 });
  return pixels(buffer);
}
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/twin-browser"),
    publicDir: path.join(root, "public"),
    plugins: [react(), tailwindcss()],
    resolve: { alias: [
      { find: "@/lib/digital-twin.functions", replacement: path.join(root, "tests/twin-browser/service-stub.ts") },
      { find: "@", replacement: path.join(root, "src") },
    ] },
    optimizeDeps: { noDiscovery: true, include: [
      "react", "react-dom/client", "react/jsx-runtime", "@tanstack/react-query", "zod", "lucide-react",
      "three", "three/addons/controls/OrbitControls.js",
    ] },
    server: { host: "127.0.0.1", port: 4179, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const width of [1280, 320]) {
    for (const theme of ["dark", "light"]) {
      for (const appearance of ["analysis", "realistic"]) {
        const name = `${width}-${theme}-${appearance}`;
        const lt = width === 320;
        const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.on("pageerror", e => errors.push(`${name}: ${e}`));
        page.on("console", m => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
        await page.goto(`http://127.0.0.1:4179/?lang=${lt ? "lt" : "en"}`);
        if (theme === "light") await page.getByRole("button", { name: "Light theme", exact: true }).click();
        await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
        if (appearance === "realistic") {
          const appearanceButton = page.getByRole("button", { name: lt ? "Kūnas" : "Body", exact: true });
          const toggle = page.getByRole("button", { name: /^(View controls|Vaizdo valdymas)$/ });
          // The mobile appearance selector lives inside the native view disclosure.
          if (!(await appearanceButton.isVisible())) await toggle.click();
          await appearanceButton.click();
          if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
          await expect(page.locator('[data-twin-stage="3d"]')).toHaveAttribute("data-twin-appearance", "realistic", { timeout: 45000 });
        }
        await expect(page.locator("canvas")).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
        const choose = page.getByLabel(lt ? "Apžiūrėti regioną" : "Inspect a region", { exact: true });
        await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
        await control(page, lt ? "Atkurti vaizdą" : "Reset view");
        const before = await shot(page, `${name}-neutral-skin`);
        expect(before.skin).toBeGreaterThan(Math.max(80, before.width * before.height * 0.015));
        // An explicit selection must stay visible even when all evidence is unknown.
        await choose.selectOption("chest");
        await control(page, lt ? "Atkurti vaizdą" : "Reset view");
        const selected = await shot(page, `${name}-selected-chest-no-data`);
        expect(selected.blue).toBeGreaterThan(before.blue + 20);
        await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
        // Back selection must reveal the back rather than highlight an occluded surface.
        await choose.selectOption("back");
        await expect.poll(async () => Math.abs(Number(await page.locator("canvas").getAttribute("data-twin-yaw")))).toBeGreaterThan(3);
        await shot(page, `${name}-selected-back-no-data`);
        // Data returns without selection manufacturing or replacing any measurement.
        await page.getByRole("button", { name: "Restore evidence", exact: true }).click();
        await choose.selectOption("chest");
        await expect(page.locator("[data-twin-reading-value]")).toContainText("77");
        await shot(page, `${name}-selected-chest-known`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: path.join(out, `${name}-page.png`), fullPage: true, animations: "disabled" });
        results.push({ name, status: "passed", before, selected, measurement: 77, errors: errors.filter(e => e.startsWith(`${name}:`)) });
        console.log(`PASS ${name}: skin=${before.skin}, selected-blue-delta=${selected.blue - before.blue}`);
        await context.close();
      }
    }
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({
    scope: "Real TwinSnapshotView and registered GLBs, synthetic evidence only; no live user data.",
    results, errors,
  }, null, 2));
  await browser?.close();
  await server?.close();
}
