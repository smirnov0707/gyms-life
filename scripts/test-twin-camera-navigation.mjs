import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";

const root = process.cwd(),
  out = path.join(root, "test-results/twin-navigation");
await mkdir(out, { recursive: true });
const results = [],
  errors = [];
let browser,
  failure = null;
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
async function skinPixels(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (r > 95 && r > g * 1.04 && g > b * 1.06) count++;
  }
  return count;
}
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const width of [320, 390, 1280])
    for (const theme of ["dark", "light"]) {
      const lt = width < 600,
        lang = lt ? "lt" : "en",
        name = `${lang}-${theme}-${width}`;
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        locale: lt ? "lt-LT" : "en-GB",
        timezoneId: "Europe/Vilnius",
        reducedMotion: "reduce",
        isMobile: width < 600,
        hasTouch: width < 600,
        deviceScaleFactor: 1,
      });
      await context.route("**/*", (route) => {
        const req = route.request();
        if (new URL(req.url()).origin === origin && req.method() === "GET") return route.continue();
        errors.push(`${name}: unexpected ${req.method()} ${req.url()}`);
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`${name}: ${m.text()}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(`${name}: HTTP ${r.status()} ${r.url()}`);
      });
      try {
        await page.goto(`${origin}/navigation.html?lang=${lang}&theme=${theme}`);
        const stage = page.locator("[data-twin-stage]"),
          canvas = stage.locator("canvas");
        await expect(stage).toHaveAttribute("data-twin-stage", "3d", { timeout: 45000 });
        await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
        const controls = stage.getByRole("button", {
          name: lt ? "Vaizdo valdymas" : "View controls",
          exact: true,
        });
        const body = page.getByRole("button", { name: lt ? "Kūnas" : "Body", exact: true });
        if (!(await body.isVisible())) await controls.click();
        await body.click();
        await expect(canvas).toHaveAttribute("data-twin-appearance", "realistic", {
          timeout: 45000,
        });
        await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
        await expect(canvas).toHaveAttribute(
          "data-twin-asset-sha256",
          "9c3bcd90d6cd5559efb1c2f166623f711f54d52cc1e93759a9d760bc63843cad",
        );
        if ((await controls.getAttribute("aria-expanded")) === "true") await controls.click();
        const read = () =>
          canvas.evaluate((el) => ({
            y: Number(el.dataset.twinTargetY),
            x: Number(el.dataset.twinTargetX),
            z: Number(el.dataset.twinTargetZ),
            pitch: Number(el.dataset.twinPitch),
            yaw: Number(el.dataset.twinYaw),
            distance: Number(el.dataset.twinDistance),
            home: Number(el.dataset.twinHomeY),
            fit: Number(el.dataset.twinFitDistance),
            height: Number(el.dataset.twinBodyHeight),
          }));
        // Camera diagnostics describe the last PAINTED frame. Opening the long
        // mobile disclosure may suspend the canvas offscreen. Bring it back before
        // observing a command; do not disable the real offscreen power-saving path.
        const showCanvas = () =>
          canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        const home = async () => {
          await showCanvas();
          await canvas.press("Home");
          await expect
            .poll(async () => Math.abs((await read()).y - (await read()).home))
            .toBeLessThan(0.001);
          await expect.poll(async () => Math.abs((await read()).yaw)).toBeLessThan(0.005);
        };
        const viewport = stage.locator("[data-twin-viewport]");
        await home();
        const largeHeight = (await viewport.boundingBox()).height;
        expect(largeHeight).toBeGreaterThanOrEqual(width < 600 ? 440 : 540);
        const larger = await skinPixels(
          await canvas.screenshot({ path: path.join(out, `${name}-larger.png`) }),
        );
        // Controlled old-size reference: the SAME camera resets to its whole-body
        // fit after resizing. No geometry or test threshold is modified.
        await viewport.evaluate((el, mobile) => {
          el.style.height = mobile
            ? "clamp(300px,42svh,360px)"
            : "clamp(360px,calc(100svh - 430px),540px)";
        }, width < 600);
        await expect
          .poll(async () => (await viewport.boundingBox()).height)
          .toBeLessThan(largeHeight);
        await home();
        const baseline = await skinPixels(
          await canvas.screenshot({ path: path.join(out, `${name}-old-size.png`) }),
        );
        await viewport.evaluate((el) => el.style.removeProperty("height"));
        await expect.poll(async () => (await viewport.boundingBox()).height).toBe(largeHeight);
        await home();
        expect(larger).toBeGreaterThan(baseline * 1.08);
        const pose = await read(),
          counter = page.locator("[data-camera-selections]");
        await stage
          .getByRole("button", { name: lt ? "Apžiūrėti aukščiau" : "Move view up", exact: true })
          .click();
        await expect.poll(async () => (await read()).y).toBeGreaterThan(pose.y + 0.1);
        expect((await read()).distance).toBeCloseTo(pose.distance, 2);
        expect((await read()).yaw).toBeCloseTo(pose.yaw, 2);
        await stage
          .getByRole("button", { name: lt ? "Apžiūrėti žemiau" : "Move view down", exact: true })
          .click();
        await expect.poll(async () => Math.abs((await read()).y - pose.y)).toBeLessThan(0.002);
        await canvas.press("ArrowUp");
        await expect.poll(async () => (await read()).y).toBeGreaterThan(pose.y);
        await canvas.press("Shift+ArrowUp");
        await expect.poll(async () => (await read()).pitch).toBeLessThan(pose.pitch - 0.05);
        await expect(counter).toHaveText("0");
        await home();
        let box = await canvas.boundingBox();
        const cx = box.x + box.width * 0.5,
          cy = box.y + box.height * 0.5;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + box.width * 0.25, cy + box.height * 0.18, { steps: 12 });
        await page.mouse.up();
        await expect.poll(async () => Math.abs((await read()).yaw)).toBeGreaterThan(0.1);
        expect(Math.abs((await read()).pitch - pose.pitch)).toBeGreaterThan(0.1);
        await expect(counter).toHaveText("0");
        await controls.click();
        const upper = stage.getByRole("button", {
          name: lt ? "Kūno viršus" : "Upper body",
          exact: true,
        });
        const lower = stage.getByRole("button", {
          name: lt ? "Kūno apačia" : "Lower body",
          exact: true,
        });
        await upper.click();
        await showCanvas();
        await expect.poll(async () => (await read()).y).toBeGreaterThan(pose.home);
        await lower.click();
        await showCanvas();
        await expect.poll(async () => (await read()).y).toBeLessThan(pose.home);
        await controls.click();
        await showCanvas();
        await canvas.screenshot({ path: path.join(out, `${name}-lower-body.png`) });
        const choose = stage.getByRole("combobox", {
          name: lt ? "Apžiūrėti regioną" : "Inspect a region",
          exact: true,
        });
        await choose.selectOption("back");
        await showCanvas();
        await expect.poll(async () => Math.abs((await read()).yaw)).toBeGreaterThan(3);
        await expect(page.locator("[data-camera-selection]")).toHaveText("back");
        await choose.selectOption("legs");
        await showCanvas();
        await expect.poll(async () => (await read()).y).toBeLessThan(pose.home);
        await expect(page.locator("[data-camera-selection]")).toHaveText("legs");
        await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
        await home();
        // Native right-button drag must pan, not select a region.
        box = await canvas.boundingBox();
        const yBefore = (await read()).y,
          countBefore = await counter.innerText();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.down({ button: "right" });
        await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.6, { steps: 10 });
        await page.mouse.up({ button: "right" });
        await expect.poll(async () => Math.abs((await read()).y - yBefore)).toBeGreaterThan(0.02);
        expect((await read()).x).toBeCloseTo(pose.x, 3);
        expect((await read()).z).toBeCloseTo(pose.z, 3);
        await expect(counter).toHaveText(countBefore);
        await home();
        if (width < 600) {
          box = await canvas.boundingBox();
          const client = await context.newCDPSession(page);
          const x = box.x + box.width * 0.5,
            y = box.y + box.height * 0.42;
          const points = (spread, dy) => [
            { id: 11, x: x - spread, y: y + dy },
            { id: 12, x: x + spread, y: y + dy },
          ];
          const before = await read();
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: points(25, 0),
          });
          for (let i = 1; i <= 8; i++)
            await client.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: points(25, i * 5),
            });
          await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await expect
            .poll(async () => Math.abs((await read()).y - before.y))
            .toBeGreaterThan(0.02);
          await expect(counter).toHaveText(countBefore);
          await home();
          const d = (await read()).distance;
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: points(22, 0),
          });
          for (let i = 1; i <= 8; i++)
            await client.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: points(22 + i * 3, 0),
            });
          await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await expect.poll(async () => (await read()).distance).toBeLessThan(d * 0.9);
          await expect(counter).toHaveText(countBefore);
          await client.detach();
        }
        await home();
        await expect
          .poll(async () => Math.abs((await read()).pitch - pose.pitch))
          .toBeLessThan(0.005);
        const targets = await stage
          .locator("[data-twin-navigation] button")
          .evaluateAll((buttons) =>
            buttons.map((b) => {
              const r = b.getBoundingClientRect();
              return { width: r.width, height: r.height };
            }),
          );
        for (const r of targets) {
          expect(r.width).toBeGreaterThanOrEqual(44);
          expect(r.height).toBeGreaterThanOrEqual(44);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
        results.push({
          name,
          status: "passed",
          height: largeHeight,
          baselineSkinPixels: baseline,
          largerSkinPixels: larger,
          pixelAreaRatio: larger / baseline,
          pose: await read(),
          trustedTwoFingerTest: width < 600,
        });
        console.log("PASS", JSON.stringify(results.at(-1)));
      } catch (error) {
        await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
        await writeFile(
          path.join(out, `${name}-failure.json`),
          JSON.stringify(
            await page.locator("canvas").evaluateAll((canvases) =>
              canvases.map((canvas) => ({
                dataset: { ...canvas.dataset },
                box: canvas.getBoundingClientRect().toJSON(),
              })),
            ),
            null,
            2,
          ),
        );
        throw error;
      } finally {
        await context.close();
      }
    }
  expect(results).toHaveLength(6);
  expect(errors).toEqual([]);
} catch (e) {
  failure = String(e);
  throw e;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        results,
        errors,
        failure,
        scope:
          "Actual shared Twin and shipped generic body with synthetic absent evidence. CDP sends trusted touch input in Chromium. Not physical iPhone or live-account acceptance.",
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await server.close();
}
