import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";

// Isolated synthetic records served by the existing real-component harness.
// No production session, account, database or AI endpoint is used here.
const engine = process.env.DESIGN_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error(`Unknown engine: ${engine}`);
const artifacts = `test-results/performance-design/${engine}`;
const origin = "http://127.0.0.1:4183";
await mkdir(artifacts, { recursive: true });
const server = spawn(process.execPath, ["scripts/test-today-browser.mjs", "--serve-only"], {
  env: { ...process.env, TODAY_BROWSER_PORT: "4183" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const results = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture start timed out")), 90_000);
    server.once("error", reject);
    server.once("exit", (code) => reject(new Error(`Fixture exited: ${code}`)));
    server.stderr.on("data", (data) => process.stderr.write(data));
    server.stdout.on("data", (data) => {
      process.stdout.write(data);
      if (String(data).includes("Reference UI fixture ready:")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium"
      ? { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
      : {},
  );
  for (const width of [1440, 390]) {
    for (const screen of ["today", "twin", "muscle", "futureme", "lab", "journal", "coach"]) {
      for (const theme of ["dark", "light"]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "en-US",
          reducedMotion: "reduce",
          colorScheme: theme,
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          return url.origin === origin || ["data:", "blob:"].includes(url.protocol)
            ? route.continue()
            : route.abort();
        });
        await page.addInitScript(() => {
          const NativeDate = Date;
          const offset = NativeDate.parse("2026-09-08T06:05:00Z") - NativeDate.now();
          globalThis.Date = new Proxy(NativeDate, {
            construct(target, args, newTarget) {
              return Reflect.construct(target, args.length ? args : [NativeDate.now() + offset], newTarget);
            },
            get(target, key, receiver) {
              return key === "now" ? () => NativeDate.now() + offset : Reflect.get(target, key, receiver);
            },
          });
        });
        const name = `${screen}-${theme}-${width}`;
        try {
          await page.goto(`${origin}/index.html?shell=1&screen=${screen}&scenario=reference&theme=${theme}`);
          await expect(page.locator(".fl-performance")).toBeVisible({ timeout: 60_000 });
          await page.evaluate(async () => {
            await document.fonts.load('700 16px "Space Grotesk"', "Ąžuolas Žygis");
            await document.fonts.load('500 16px "Manrope"', "Ąžuolas Žygis");
            await document.fonts.ready;
          });
          await expect(page.locator("#main-content")).not.toBeEmpty();
          if (screen === "today") await expect(page.locator(".fl-plan-start")).toBeVisible();
          if (screen === "coach") await expect(page.locator("[data-coach-send]")).toBeVisible();
          // Wait for mounted canvas assets without disabling the fallback renderer.
          await page.waitForTimeout(1200);
          const geometry = await page.evaluate(() => {
            const measure = (selector) => {
              const element = document.querySelector(selector);
              if (!element) return null;
              const box = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return { x: box.x, y: box.y, width: box.width, height: box.height,
                bottom: box.bottom, fontSize: parseFloat(style.fontSize),
                fontWeight: style.fontWeight, radius: style.borderRadius };
            };
            return { overflow: document.documentElement.scrollWidth - innerWidth,
              heading: measure(".fl-greeting h1, .fl-world-title, .fl-page-heading h1"),
              action: measure(".fl-plan-start, [data-coach-send]"),
              dock: measure(".fl-mobile-navigation") };
          });
          // Capture before asserting so a failure remains visually reviewable.
          await page.screenshot({ path: `${artifacts}/${name}.png`, animations: "disabled" });
          expect(geometry.overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
          if (["today", "coach"].includes(screen)) {
            expect(geometry.action.height, `${name}: touch target`).toBeGreaterThanOrEqual(44);
            if (width === 390) {
              expect(geometry.action.bottom, `${name}: action above dock`).toBeLessThanOrEqual(geometry.dock.y);
            }
          }
          if (screen === "today") {
            expect(Number(geometry.heading.fontWeight)).toBeGreaterThanOrEqual(700);
            expect(geometry.heading.fontSize).toBeGreaterThanOrEqual(width === 390 ? 28 : 48);
          }
          expect(errors, `${name}: page errors`).toEqual([]);
          results.push({ name, ...geometry, status: "passed" });
          console.log(`PASS ${name}`);
        } catch (error) {
          results.push({ name, status: "failed", error: String(error), errors });
          await page.screenshot({ path: `${artifacts}/${name}-failure.png`, timeout: 15_000 }).catch(() => {});
          console.error(`FAIL ${name}: ${error}`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  await writeFile(`${artifacts}/tested-commit.txt`, process.env.GITHUB_SHA ?? "local");
  await browser?.close();
  server.kill("SIGTERM");
}
if (results.length !== 28 || results.some((result) => result.status !== "passed")) {
  throw new Error(`Performance design: ${results.filter((result) => result.status === "failed").length} failures across ${results.length}/28 views`);
}
