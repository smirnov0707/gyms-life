import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";

const root = process.cwd();
const engine = process.env.TWIN_BROWSER_ENGINE || "chromium";
assert(["chromium", "webkit"].includes(engine));
const out = path.join(root, `test-results/twin-natural-${engine}`);
await mkdir(out, { recursive: true });
const server = await createServer({
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
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
const results = [],
  errors = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium"
      ? {
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        }
      : {},
  );
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    const name = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: true,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET")
        return route.continue();
      errors.push(`${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    try {
      await page.goto(`${origin}/navigation.html?lang=lt&theme=dark&scroll-test=1`);
      const canvas = page.locator("canvas");
      const stage = page.locator("[data-twin-stage]");
      const toggle = page.locator("[data-twin-interaction-toggle]");
      await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
      await expect(canvas).toHaveAttribute(
        "data-twin-asset-sha256",
        "e8c3b61188950be16737c0f205e8bdfcd5c6f3959a3daebfcc66a8eea4a94ed0",
      );
      await expect(stage).toHaveAttribute("data-twin-appearance", "analysis");
      await expect(page.locator("[data-twin-candidate-status]")).toHaveCount(0);
      const height = (await canvas.boundingBox()).height;
      expect(height).toBeGreaterThanOrEqual(220);
      expect(height).toBeLessThanOrEqual(
        Math.max(220, viewport.height - (viewport.width < 1024 ? 320 : 260)) + 1,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      await expect(canvas).toHaveCSS("touch-action", "pan-y pinch-zoom");
      await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      await canvas.press("Home");
      await canvas.screenshot({ path: path.join(out, `${name}-front.png`) });
      const yaw = Number(await canvas.getAttribute("data-twin-yaw"));
      const scroll = await page.evaluate(() => scrollY);
      const box = await canvas.boundingBox();
      if (engine === "chromium") {
        const cdp = await context.newCDPSession(page);
        // Real one-finger swipe starts on the model, not a page margin.
        await canvas.evaluate((el) => {
          window.__scrollPointers = [];
          for (const name of ["pointerdown", "pointermove", "pointercancel", "pointerup"])
            el.addEventListener(
              name,
              (event) =>
                window.__scrollPointers.push({
                  type: event.type,
                  y: event.clientY,
                  prevented: event.defaultPrevented,
                }),
              { passive: true },
            );
        });
        const point = (dy) => [
          { id: 1, x: box.x + box.width / 2, y: box.y + box.height * 0.72 - dy },
        ];
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(0) });
        for (let dy = 6; dy <= 132; dy += 6) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(dy) });
          await page.waitForTimeout(20);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      } else {
        // Playwright mobile WebKit has neither trusted swipe nor wheel APIs.
        // Native PageDown (wheel on desktop) tests scroll ownership; touch-action
        // and mobile rendering are checked separately. No physical iPhone claim.
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        if (viewport.width < 1000) await page.keyboard.press("PageDown");
        else await page.mouse.wheel(0, 180);
      }
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 40);
      expect(Number(await canvas.getAttribute("data-twin-yaw"))).toBeCloseTo(yaw, 2);
      await expect(page.locator("[data-camera-selections]")).toHaveText("0");
      await toggle.click();
      await expect(canvas).toHaveCSS("touch-action", "none");
      await expect(toggle).toHaveText("Baigti");
      await toggle.click();
      await expect(canvas).toHaveCSS("touch-action", "pan-y pinch-zoom");
      await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      await canvas.press("ArrowRight");
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-twin-yaw")))
        .not.toBe(yaw);
      await canvas.screenshot({ path: path.join(out, `${name}-side.png`) });
      if (viewport.width === 390) {
        const settings = page.getByRole("button", { name: "Vaizdo valdymas", exact: true });
        for (const [preset, label] of [
          ["Kūno viršus", "torso-front"],
          ["Kairysis šonas", "torso-side"],
          ["Nugara", "torso-back"],
        ]) {
          await settings.click();
          await page.getByRole("button", { name: preset, exact: true }).click();
          await settings.click();
          await canvas.evaluate((el) =>
            el.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await canvas.screenshot({ path: path.join(out, `${name}-${label}.png`) });
        }
      }
      // Resize/rotate without remount: camera refits the same verified body.
      if (viewport.width === 390) {
        await page.setViewportSize({ width: 844, height: 390 });
        await expect.poll(async () => (await canvas.boundingBox()).height).toBe(220);
        await page.setViewportSize(viewport);
        await expect.poll(async () => (await canvas.boundingBox()).height).toBe(height);
        await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        await canvas.press("Home");
        await page.emulateMedia({ reducedMotion: "no-preference" });
        const breath = async () => Number(await canvas.getAttribute("data-twin-breath"));
        await expect.poll(breath, { timeout: 8000, intervals: [60] }).toBeLessThan(0.08);
        const rest = await canvas.screenshot({ path: path.join(out, "rest.png") });
        await expect.poll(breath, { timeout: 8000, intervals: [60] }).toBeGreaterThan(0.92);
        const inhale = await canvas.screenshot({ path: path.join(out, "inhale.png") });
        const a = await sharp(rest).raw().toBuffer(),
          b = await sharp(inhale).raw().toBuffer();
        let changed = 0;
        for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 5) changed++;
        expect(changed).toBeGreaterThan(100);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(canvas).toHaveAttribute("data-twin-breath", "0.0000");
        await page.waitForTimeout(250);
        const frames = await canvas.getAttribute("data-twin-frames");
        await page.waitForTimeout(300);
        expect(await canvas.getAttribute("data-twin-frames")).toBe(frames);
        await page.locator('[aria-label="Vaizdo valdymas"]').click();
        await page.getByLabel("Subtilus judesys", { exact: true }).uncheck();
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        await expect(canvas).toHaveAttribute("data-twin-breath", "0.0000");
        results.push({ name, breathingChangedChannels: changed, reducedMotion: "passed" });
      }
      await page.screenshot({ path: path.join(out, `${name}-page.png`), fullPage: true });
      results.push({ name, height, scroll: "passed", interaction: "passed" });
    } catch (error) {
      console.log(
        "SCROLL_DIAGNOSTICS",
        JSON.stringify(
          await page.evaluate(() => ({
            windowY: scrollY,
            bodyY: document.body.scrollTop,
            rootY: document.documentElement.scrollTop,
            innerHeight,
            scrolling: document.scrollingElement?.tagName,
            pointers: window.__scrollPointers,
            ancestors: (() => {
              const rows = [];
              let el = document.querySelector("canvas");
              while (el) {
                const s = getComputedStyle(el);
                rows.push({
                  tag: el.tagName,
                  touch: s.touchAction,
                  overflow: s.overflowY,
                  top: el.getBoundingClientRect().top,
                  height: el.clientHeight,
                  scrollHeight: el.scrollHeight,
                });
                el = el.parentElement;
              }
              return rows;
            })(),
          })),
        ),
      );
      await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
      throw error;
    } finally {
      await context.close();
    }
  }
  expect(errors).toEqual([]);
  console.log("PASS", engine, JSON.stringify(results));
} finally {
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify({ engine, results, errors }, null, 2),
  );
  await browser?.close();
  await server.close();
}
