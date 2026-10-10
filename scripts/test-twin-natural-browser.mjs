import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";
import { CONTENT_SECURITY_POLICY } from "../src/lib/security-headers.server.ts";

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
  server: {
    host: "127.0.0.1",
    port: 0,
    fs: { allow: [root] },
    // Exercise the policy actually sent by SSR. A successful GLB download
    // does not prove its embedded textures can decode under production CSP.
    headers: { "Content-Security-Policy": CONTENT_SECURITY_POLICY },
  },
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
          ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
            : {}),
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
    if (viewport.width === 390) await page.clock.install();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      await page.goto(`${origin}/navigation.html?lang=lt&theme=dark&scroll-test=1`);
      const canvas = page.locator("canvas");
      const stage = page.locator("[data-twin-stage]");
      const toggle = page.locator("[data-twin-interaction-toggle]");
      await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
      await expect(canvas).toHaveAttribute(
        "data-twin-asset-sha256",
        "b21543c3c2113a8f95ff6843d4c6ce226352b0b61179144a663353fee2bebe70",
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
      const zoomControls = stage.locator("[data-twin-zoom-controls]");
      await expect(zoomControls).toHaveCount(0);
      await toggle.click();
      await expect(canvas).toHaveCSS("touch-action", "none");
      await expect(toggle).toHaveText("Baigti");
      const zoomIn = zoomControls.getByRole("button", { name: "Priartinti", exact: true });
      const zoomOut = zoomControls.getByRole("button", { name: "Nutolinti", exact: true });
      const reset = zoomControls.getByRole("button", { name: "Atkurti vaizdą", exact: true });
      const distance = async () => Number(await canvas.getAttribute("data-twin-distance"));
      await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      const originalDistance = await distance();
      // Use the real touch targets, with settings closed, even in landscape.
      for (const button of [zoomIn, zoomOut, reset]) {
        const target = await button.boundingBox();
        const bounds = await canvas.boundingBox();
        const done = await toggle.boundingBox();
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
        expect(target.x).toBeGreaterThanOrEqual(bounds.x);
        expect(target.y).toBeGreaterThanOrEqual(bounds.y);
        expect(target.x + target.width).toBeLessThanOrEqual(done.x - 4);
        expect(target.y + target.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
      await zoomIn.tap();
      await expect.poll(distance).toBeLessThan(originalDistance * 0.95);
      await zoomOut.tap();
      await expect
        .poll(async () => Math.abs((await distance()) - originalDistance))
        .toBeLessThan(0.002);
      await zoomIn.tap();
      await stage.getByRole("button", { name: "Apžiūrėti aukščiau", exact: true }).tap();
      await canvas.press("ArrowRight");
      await reset.tap();
      await expect
        .poll(async () => Math.abs((await distance()) - originalDistance))
        .toBeLessThan(0.002);
      await expect
        .poll(async () => Math.abs(Number(await canvas.getAttribute("data-twin-yaw"))))
        .toBeLessThan(0.005);
      await expect
        .poll(async () =>
          Math.abs(
            Number(await canvas.getAttribute("data-twin-target-y")) -
              Number(await canvas.getAttribute("data-twin-home-y")),
          ),
        )
        .toBeLessThan(0.002);
      await expect(page.locator("[data-camera-selections]")).toHaveText("0");
      await stage
        .locator("[data-twin-viewport]")
        .screenshot({ path: path.join(out, `${name}-touch-controls.png`) });
      await reset.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(zoomControls).toHaveCount(0);
      await expect(canvas).toHaveCSS("touch-action", "pan-y pinch-zoom");
      await toggle.click();
      await expect(zoomIn).toBeVisible();
      await toggle.click();
      await expect(zoomControls).toHaveCount(0);
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
        // Freeze the browser clock at each phase. A screenshot can take long
        // enough on a loaded CI runner for a live breath to leave that phase.
        await page.clock.pauseAt(new Date(Date.now() + 100));
        const time = await page.evaluate(() => performance.now());
        await page.clock.runFor(((5000 - (time % 5200) + 5200) % 5200) + 1);
        expect(await breath()).toBeLessThan(0.08);
        const rest = await canvas.screenshot({ path: path.join(out, "rest.png") });
        await page.clock.runFor(2100);
        expect(await breath()).toBeGreaterThan(0.92);
        const inhale = await canvas.screenshot({ path: path.join(out, "inhale.png") });
        await page.clock.resume();
        const a = await sharp(rest).raw().toBuffer(),
          b = await sharp(inhale).raw().toBuffer();
        let changed = 0;
        for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 5) changed++;
        expect(changed).toBeGreaterThan(800);
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
      if (viewport.width === 1280) {
        await canvas.press("Home");
        await canvas.press("ArrowUp");
        for (let step = 0; step < 6; step++) await canvas.press("+");
        await canvas.evaluate((element) => element.blur());
        await canvas.screenshot({ path: path.join(out, "veins-front-detail.png") });
        for (let step = 0; step < 4; step++) await canvas.press("+");
        for (let step = 0; step < 3; step++) await canvas.press("ArrowUp");
        await canvas.evaluate((element) => element.blur());
        await canvas.screenshot({ path: path.join(out, "skin-finish-detail.png") });
        await canvas.press("ArrowRight");
        await canvas.press("ArrowRight");
        await canvas.evaluate((element) => element.blur());
        await canvas.screenshot({ path: path.join(out, "eye-three-quarter.png") });
        const eyeTextures = await page.evaluate(async () => {
          const { reviewEyeMaterialLifetime } = await import("/eye-material-review.ts");
          return reviewEyeMaterialLifetime();
        });
        for (const cycle of eyeTextures) {
          expect(cycle.peak).toBeGreaterThanOrEqual(3);
          expect(cycle.retained).toBeLessThan(cycle.peak);
          expect(cycle.disposals).toBe(1);
        }
        expect(eyeTextures[1].retained).toBeLessThanOrEqual(eyeTextures[0].retained);
        results.push({ name, eyeTextures });
      }
      results.push({
        name,
        height,
        scroll: "passed",
        interaction: "passed",
        touchZoomAndReset: "passed",
      });
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
