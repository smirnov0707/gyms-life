import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.TWIN_CONTROL_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown Twin control engine");
const out = path.join(root, "test-results/twin-layer-controls", engine);
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/twin-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(root, "src") } },
  optimizeDeps: { entries: [path.join(root, "tests/twin-browser/layer-controls.html")] },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
let browser;
let failure = null;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("No fixture HTTP address");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const lang of ["lt", "en"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 390, 1280]) {
        for (const textScale of [1, 2]) {
          const name = `${engine}-${lang}-${theme}-${width}-text${textScale}`;
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            locale: lang === "lt" ? "lt-LT" : "en-GB",
            timezoneId: "Europe/Vilnius",
            reducedMotion: "reduce",
            hasTouch: width < 600,
            isMobile: width < 600,
          });
          await context.route("**/*", (route) => {
            const request = route.request();
            if (new URL(request.url()).origin === origin && request.method() === "GET")
              return route.continue();
            errors.push(`${name}: unexpected request ${request.method()} ${request.url()}`);
            return route.abort();
          });
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(`${name}: ${String(error)}`));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(`${name}: ${message.text()}`);
          });
          page.on("response", (response) => {
            if (response.status() >= 400)
              errors.push(`${name}: asset ${response.status()} ${response.url()}`);
          });
          try {
            await page.goto(`${origin}/layer-controls.html?lang=${lang}&theme=${theme}`);
            await expect(page.locator("[data-twin-layer-option]")).toHaveCount(6);
            await page.evaluate(() => document.fonts.ready);
            if (textScale === 2) {
              await page.locator("[data-twin-layer-option]").evaluateAll((buttons) => {
                for (const button of buttons)
                  button.style.fontSize = `${parseFloat(getComputedStyle(button).fontSize) * 2}px`;
              });
            }
            const layouts = [];
            for (const variant of ["full", "cockpit"]) {
              const section = page.locator(`[data-variant="${variant}"]`);
              await expect(section.locator("[data-changes]")).toHaveText("0");
              const geometry = await section.locator("[data-twin-layer-controls]").evaluate((el) => {
                const box = el.getBoundingClientRect();
                const buttons = [...el.querySelectorAll("button")].map((button) => {
                  const rect = button.getBoundingClientRect();
                  const label = button.querySelector("[data-twin-layer-label]");
                  const range = document.createRange();
                  range.selectNodeContents(label);
                  const lines = [...range.getClientRects()];
                  return {
                    id: button.dataset.twinLayerOption,
                    text: label.textContent,
                    name: button.getAttribute("aria-label"),
                    height: rect.height,
                    top: rect.top,
                    inside: rect.left >= box.left && rect.right <= box.right + 1,
                    textInside: lines.every((line) =>
                      line.left >= rect.left && line.right <= rect.right + 1,
                    ),
                    lines: lines.length,
                    clipX: button.scrollWidth - button.clientWidth,
                    clipY: button.scrollHeight - button.clientHeight,
                  };
                });
                return { left: box.left, right: box.right, buttons };
              });
              expect(geometry.left).toBeGreaterThanOrEqual(0);
              expect(geometry.right).toBeLessThanOrEqual(width);
              for (const button of geometry.buttons) {
                expect(button.inside).toBe(true);
                expect(button.textInside).toBe(true);
                expect(button.lines).toBe(1);
                expect(button.clipX).toBeLessThanOrEqual(1);
                expect(button.clipY).toBeLessThanOrEqual(1);
                expect(button.height).toBeGreaterThanOrEqual(variant === "full" ? 44 : 30);
              }
              if (textScale === 1) {
                const tops = geometry.buttons.map((button) => button.top);
                expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
              }
              for (const id of ["recovery", "logged_volume", "todays_session"]) {
                const button = section.locator(`[data-twin-layer-option="${id}"]`);
                await button.click();
                await expect(button).toHaveAttribute("aria-pressed", "true");
                await expect(section.locator('[aria-pressed="true"]')).toHaveCount(1);
                await expect(section.locator("[data-selection]")).toHaveText(id);
              }
              const first = section.locator('[data-twin-layer-option="recovery"]');
              await first.focus();
              await page.keyboard.press("Tab");
              const volume = section.locator('[data-twin-layer-option="logged_volume"]');
              await expect(volume).toBeFocused();
              await page.keyboard.press("Space");
              await expect(section.locator("[data-selection]")).toHaveText("logged_volume");
              await expect(section.locator("[data-changes]")).toHaveText("4");
              layouts.push({ variant, ...geometry });
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth))
              .toBeLessThanOrEqual(width + 1);
            if (width === 320)
              await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
            results.push({ name, status: "passed", layouts });
            console.log("PASS", name);
          } finally {
            await context.close();
          }
        }
      }
    }
  }
  expect(results).toHaveLength(24);
  expect(errors).toEqual([]);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ engine, expectedGroups: 24, results, errors, failure }, null, 2),
  );
  await browser?.close();
  await server.close();
}
