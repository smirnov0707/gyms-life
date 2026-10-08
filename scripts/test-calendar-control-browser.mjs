import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.CONTROL_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown calendar engine");
const artifacts = path.join(root, "test-results/control-surface", engine, "calendar");
await mkdir(artifacts, { recursive: true });
const results = [];
const errors = [];
let browser;
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/control-browser"),
  cacheDir: path.join(root, "node_modules/.vite-calendar-control"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(root, "src") } },
  optimizeDeps: { entries: [path.join(root, "tests/control-browser/calendar.html")] },
  server: { host: "127.0.0.1", port: 4190, strictPort: true, fs: { allow: [root] } },
});
try {
  await server.listen();
  const origin = "http://127.0.0.1:4190";
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 1280]) {
      const name = `${engine} ${theme} ${width}px calendar`;
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "en-GB",
        timezoneId: "Europe/Vilnius",
        hasTouch: width < 600,
        isMobile: width < 600,
        reducedMotion: "reduce",
      });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin && route.request().method() === "GET") return route.continue();
        errors.push(`Unexpected calendar request: ${url.origin}${url.pathname}`);
        return route.abort();
      });
      const page = await context.newPage();
      const diagnostics = [];
      page.on("pageerror", (error) => errors.push(`${name}: ${String(error)}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`${name}: console: ${message.text()}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400)
          errors.push(`${name}: asset ${response.status()} ${new URL(response.url()).pathname}`);
      });
      page.on("requestfailed", (request) => {
        diagnostics.push({ url: request.url(), failure: request.failure()?.errorText });
      });
      let geometry = null;
      try {
        const response = await page.goto(`${origin}/calendar.html?theme=${theme}`);
        expect(response?.status()).toBe(200);
        const calendar = page.locator('[data-slot="calendar"]');
        const days = calendar.locator("button[data-day]");
        await expect(days.filter({ hasText: /^14$/ })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        geometry = await calendar.evaluate((element) => {
          const caption = element.querySelector(".rdp-month_caption").getBoundingClientRect();
          const nav = element.querySelector(".rdp-button_next").getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          const cells = [...element.querySelectorAll("button[data-day]")].map((day) => {
            const rect = day.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          });
          const overlaps = cells.filter((a, index) =>
            cells
              .slice(index + 1)
              .some(
                (b) =>
                  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
                  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1,
              ),
          ).length;
          return {
            navHeight: nav.height,
            captionHeight: caption.height,
            captionCenterDelta: Math.abs(nav.y + nav.height / 2 - caption.y - caption.height / 2),
            minDayWidth: Math.min(...cells.map((cell) => cell.width)),
            minDayHeight: Math.min(...cells.map((cell) => cell.height)),
            overlaps,
            left: bounds.left,
            right: bounds.right,
            documentWidth: document.documentElement.scrollWidth,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        console.log("CALENDAR_GEOMETRY", name, JSON.stringify(geometry));
        await page.screenshot({
          path: path.join(artifacts, `${theme}-${width}.png`),
          fullPage: true,
        });
        expect(geometry.overlaps).toBe(0);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(width);
        expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
        expect(geometry.captionCenterDelta).toBeLessThanOrEqual(1);
        expect(geometry.minDayWidth).toBeGreaterThanOrEqual(32);
        expect(geometry.minDayHeight).toBeGreaterThanOrEqual(32);
        const day = days.filter({ hasText: /^14$/ });
        await day.click();
        await expect(page.getByLabel("Selected date")).toHaveText("2026-10-14");
        await expect(day).toHaveAttribute("data-selected-single", "true");
        await day.focus();
        await page.keyboard.press("ArrowRight");
        await expect(days.filter({ hasText: /^16$/ })).toBeFocused();
        const disabled = days.filter({ hasText: /^15$/ });
        await expect(disabled).toBeDisabled();
        await disabled.evaluate((element) => element.click());
        await expect(page.getByLabel("Selected date")).toHaveText("2026-10-14");
        await calendar.locator(".rdp-button_next").click();
        await expect(calendar.locator(".rdp-caption_label")).toHaveText("November 2026");
        await calendar.locator(".rdp-button_previous").click();
        await expect(calendar.locator(".rdp-caption_label")).toHaveText("October 2026");
        await expect(page.getByLabel("Form submissions")).toHaveText("0");
        results.push({ name, status: "passed", geometry });
      } catch (error) {
        const reason = String(error);
        results.push({ name, status: "failed", geometry, reason, diagnostics });
        console.error("CALENDAR_FAILURE", name, reason, JSON.stringify(diagnostics));
        const htmlPath = path.join(artifacts, `${theme}-${width}-failed.html`);
        await writeFile(htmlPath, await page.content());
        await page.screenshot({
          path: path.join(artifacts, `${theme}-${width}-failed.png`),
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    }
  }
  if (results.length !== 6 || results.some((item) => item.status !== "passed") || errors.length)
    throw new Error(`Calendar acceptance failed: ${JSON.stringify({ results, errors })}`);
} finally {
  await browser?.close();
  await server.close();
  await writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify({ engine, source: process.env.GITHUB_SHA, results, errors }, null, 2),
  );
}
