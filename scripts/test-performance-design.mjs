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
  const reviewCases = ["dark", "light"].map((theme) => ({
    width: 320,
    screen: "twin",
    theme,
    lang: "lt",
    navigation: true,
  }));
  for (const theme of ["dark", "light"]) {
    reviewCases.push({ width: 320, screen: "today", theme, lang: "lt", navigation: false });
    reviewCases.push({ width: 320, screen: "signals", theme, lang: "lt", navigation: false });
  }
  for (const width of [1440, 390]) {
    for (const screen of [
      "today",
      "twin",
      "muscle",
      "signals",
      "futureme",
      "lab",
      "journal",
      "coach",
    ]) {
      for (const theme of ["dark", "light"]) {
        reviewCases.push({ width, screen, theme, lang: "en", navigation: false });
      }
    }
  }
  for (const { width, screen, theme, lang, navigation } of reviewCases) {
    const context = await browser.newContext({
      viewport: { width, height: width <= 390 ? 844 : 1000 },
      locale: lang === "lt" ? "lt-LT" : "en-US",
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
          return Reflect.construct(
            target,
            args.length ? args : [NativeDate.now() + offset],
            newTarget,
          );
        },
        get(target, key, receiver) {
          return key === "now"
            ? () => NativeDate.now() + offset
            : Reflect.get(target, key, receiver);
        },
      });
    });
    const name = navigation
      ? `navigation-${lang}-${theme}-${width}`
      : `${screen}-${theme}-${width}`;
    try {
      const routeScreen = screen === "signals" ? "twin" : screen;
      const view = screen === "signals" ? "&view=systems" : "";
      await page.goto(
        `${origin}/index.html?shell=1&screen=${routeScreen}&scenario=reference&theme=${theme}&lang=${lang}${view}`,
      );
      await expect(page.locator(".future-lab-app.fl-performance-shell")).toBeVisible({
        timeout: 60_000,
      });
      await page.evaluate(async () => {
        await document.fonts.load('700 16px "Space Grotesk"', "Ąžuolas Žygis");
        await document.fonts.load('500 16px "Manrope"', "Ąžuolas Žygis");
        await document.fonts.ready;
      });
      await expect(page.locator("#main-content")).not.toBeEmpty();
      if (screen === "today") await expect(page.locator(".fl-plan-start")).toBeVisible();
      if (screen === "coach") await expect(page.locator("[data-coach-send]")).toBeVisible();
      if (screen === "signals") {
        await expect(page.locator(".fl-twin-systems .fl-live-signals").getByRole("img"))
          .toHaveCount(7);
      }
      if (screen === "muscle") {
        // Detail is opened through the real body selector, not a separate route.
        await page
          .locator("summary")
          .filter({ hasText: /^Muscles$/ })
          .click();
        await page
          .getByRole("button", { name: /^Chest(?:\s|$)/ })
          .first()
          .click();
        await expect(page.locator('[data-twin-muscle-detail="chest"]')).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
      }
      // Require the shipped figure before capturing Twin evidence. A timer alone
      // can photograph a blank stage while the first model request is loading.
      if (["twin", "muscle"].includes(screen)) {
        const canvas = page.locator("canvas[data-twin-frames]").first();
        await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 60_000 });
        await expect
          .poll(async () => Number(await canvas.getAttribute("data-twin-frames")))
          .toBeGreaterThanOrEqual(1);
      }
      await page.waitForTimeout(1200);
      const geometry = await page.evaluate(() => {
        const measure = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            bottom: box.bottom,
            fontSize: parseFloat(style.fontSize),
            fontWeight: style.fontWeight,
            radius: style.borderRadius,
            background: style.backgroundColor,
            backgroundImage: style.backgroundImage,
          };
        };
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          heading: measure(
            ".fl-greeting h1, .fl-world-title, .fl-page-heading h1, .fl-future-heading h1",
          ),
          action: measure(".fl-plan-start, [data-coach-send], .fl-strength-summary > button"),
          dock: measure(".fl-mobile-navigation"),
          command: measure(".fl-today-command"),
          navigationLabel: measure(".fl-mobile-navigation a > span"),
        };
      });
      // Capture before asserting so a failure remains visually reviewable.
      await page.screenshot({ path: `${artifacts}/${name}.png`, animations: "disabled" });
      expect(geometry.overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
      if (width <= 390) {
        expect(
          geometry.navigationLabel.fontSize,
          `${name}: readable navigation`,
        ).toBeGreaterThanOrEqual(11);
      }
      if (["today", "coach", "futureme"].includes(screen)) {
        expect(geometry.action.height, `${name}: touch target`).toBeGreaterThanOrEqual(44);
        if (width <= 390) {
          expect(geometry.action.bottom, `${name}: action above dock`).toBeLessThanOrEqual(
            geometry.dock.y,
          );
        }
      }
      if (screen === "today") {
        expect(Number(geometry.heading.fontWeight)).toBeGreaterThanOrEqual(700);
        expect(geometry.heading.fontSize).toBeGreaterThanOrEqual(width <= 390 ? 26 : 36);
        const exercises = page.locator(".fl-plan-details");
        await expect(exercises.locator("ul")).toBeHidden();
        await exercises.locator("summary").press("Enter");
        await expect(exercises.locator("li")).toHaveCount(5);
        await expect(exercises.locator("li").first()).toContainText("4 × 6");
        await exercises.locator("summary").press("Enter");
        await expect(exercises.locator("ul")).toBeHidden();
        const quick = page.locator(".fl-today-quick-actions");
        const disclosures = quick.locator(":scope > details");
        const summaries = quick.locator(":scope > details > summary");
        await expect(summaries).toHaveText(
          lang === "lt" ? ["Šiandien bėgau", "Įrašyti maistą"] : ["I ran today", "Log food"],
        );
        const closed = await summaries.evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            return { top: box.top, left: box.left, right: box.right, height: box.height };
          }),
        );
        geometry.quickActions = closed;
        expect(Math.abs(closed[0].top - closed[1].top)).toBeLessThanOrEqual(1);
        expect(closed[1].left).toBeGreaterThan(closed[0].right);
        for (const item of closed) expect(item.height).toBeGreaterThanOrEqual(44);
        for (let index = 0; index < 2; index++) {
          await summaries.nth(index).press("Enter");
          await expect(disclosures.nth(index).locator(":scope > div")).toBeVisible();
          const expanded = await disclosures.nth(index).evaluate((element) => ({
            width: element.getBoundingClientRect().width,
            available: element.parentElement.getBoundingClientRect().width,
            overflow: document.documentElement.scrollWidth - innerWidth,
          }));
          expect(Math.abs(expanded.width - expanded.available)).toBeLessThanOrEqual(1);
          expect(expanded.overflow).toBeLessThanOrEqual(1);
          if (width === 320) {
            await page.screenshot({
              path: `${artifacts}/${name}-${index === 0 ? "run" : "food"}-open.png`,
              fullPage: true,
              animations: "disabled",
            });
          }
          await summaries.nth(index).press("Enter");
          await expect(disclosures.nth(index).locator(":scope > div")).toBeHidden();
          await expect(summaries.nth(index)).toBeFocused();
        }
      }
      if (screen === "lab") {
        const methods = page.locator(".fl-lab-methods");
        await expect(methods.locator(".fl-lab-domains")).toBeHidden();
        await methods.locator(":scope > summary").press("Enter");
        await expect(methods.locator(".fl-lab-domains")).toBeVisible();
        await methods.locator(":scope > summary").press("Enter");
        await expect(methods.locator(".fl-lab-domains")).toBeHidden();
      }
      if (screen === "signals") {
        const signals = page.locator(".fl-twin-systems > .fl-live-signals");
        const rows = signals.locator(":scope > ul > li");
        await expect(rows).toHaveCount(7);
        await expect(signals.getByRole("img")).toHaveCount(7);
        const evidence = page.locator(".fl-twin-systems > details");
        const summary = evidence.locator(":scope > summary");
        await expect(summary).toHaveText(
          lang === "lt" ? "Miegas ir atsistatymas" : "Sleep & recovery",
        );
        const content = evidence.locator(":scope > div");
        await expect(content).toBeHidden();
        const layout = await signals.evaluate((element) => {
          const heading = element.querySelector("h2");
          return {
            headingSize: parseFloat(getComputedStyle(heading).fontSize),
            rows: [...element.querySelectorAll(":scope > ul > li")].map((row) => {
              const box = row.getBoundingClientRect();
              return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
            }),
          };
        });
        geometry.signals = layout;
        expect(layout.headingSize).toBeGreaterThanOrEqual(24);
        if (width <= 390) {
          for (let index = 1; index < layout.rows.length; index++) {
            expect(layout.rows[index].top).toBeGreaterThanOrEqual(layout.rows[index - 1].bottom);
          }
          expect(layout.rows.at(-1).bottom).toBeLessThanOrEqual(geometry.dock.y);
          const box = await summary.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.y + box.height).toBeLessThanOrEqual(geometry.dock.y);
        } else {
          expect(Math.abs(layout.rows[0].top - layout.rows[1].top)).toBeLessThanOrEqual(1);
          expect(layout.rows[1].left).toBeGreaterThanOrEqual(layout.rows[0].right);
        }
        await summary.press("Enter");
        await expect(content).toBeVisible();
        await expect(content.locator(":scope > p")).toBeVisible();
        await expect(content.locator(".fl-sleep-analysis")).toBeVisible();
        await expect(content.locator(":scope > section")).toHaveCount(2);
        if (width === 320) {
          await page.screenshot({
            path: `${artifacts}/${name}-analysis-open.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1);
        await summary.press("Enter");
        await expect(content).toBeHidden();
        await expect(summary).toBeFocused();
      }
      if (screen === "futureme" && width === 390) {
        expect(geometry.heading.fontSize).toBeGreaterThanOrEqual(28);
      }
      if (navigation) {
        await expect(page.locator(".fl-mobile-navigation a")).toHaveText([
          "ŠIANDIEN",
          "DVYNYS",
          "LAB",
          "TRENERIS",
        ]);
        const tabs = page.locator('.twin-screen > [role="tablist"]');
        const buttons = tabs.getByRole("tab");
        await expect(buttons).toHaveText(["Kūnas", "Rodikliai", "Prognozė", "Istorija"]);
        const layout = await tabs.evaluate((element) => {
          const parent = element.getBoundingClientRect();
          return [...element.querySelectorAll('[role="tab"]')].map((button) => {
            const box = button.getBoundingClientRect();
            const text = document.createRange();
            text.selectNodeContents(button);
            return {
              label: button.textContent.trim(),
              left: box.left - parent.left,
              right: box.right - parent.right,
              width: box.width,
              height: box.height,
              textOverflow: button.scrollWidth - button.clientWidth,
              textHeight: text.getBoundingClientRect().height,
              lineHeight: parseFloat(getComputedStyle(button).lineHeight),
            };
          });
        });
        geometry.navigationTabs = layout;
        for (const item of layout) {
          expect(item.left, item.label).toBeGreaterThanOrEqual(0);
          expect(item.right, item.label).toBeLessThanOrEqual(1);
          expect(item.width, item.label).toBeGreaterThanOrEqual(44);
          expect(item.height, item.label).toBeGreaterThanOrEqual(44);
          expect(item.textOverflow, item.label).toBeLessThanOrEqual(1);
          expect(item.textHeight, item.label).toBeLessThanOrEqual(item.lineHeight + 2);
        }
        await buttons.first().press("End");
        await expect(buttons.last()).toBeFocused();
        await expect(buttons.last()).toHaveAttribute("aria-selected", "true");
        await expect(
          page.getByRole("heading", { name: "Tavo istorija", exact: true }),
        ).toBeVisible();
        await buttons.last().press("Home");
        await expect(buttons.first()).toBeFocused();
        await expect(buttons.first()).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("#twin-panel-overview")).toBeVisible();
      }
      if (screen === "muscle") {
        await page.getByRole("button", { name: "Body", exact: true }).click();
        await expect(page.locator("#twin-panel-overview")).toBeVisible();
        await expect(page.locator("[data-twin-muscle-detail]")).toHaveCount(0);
        await expect(page.locator("canvas[data-twin-frames]").first()).toHaveAttribute(
          "data-twin-body",
          "human",
          { timeout: 60_000 },
        );
        expect(new URL(page.url()).searchParams.has("region")).toBe(false);
      }
      expect(errors, `${name}: page errors`).toEqual([]);
      results.push({ name, ...geometry, status: "passed" });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, status: "failed", error: String(error), errors });
      await page
        .screenshot({ path: `${artifacts}/${name}-failure.png`, timeout: 15_000 })
        .catch(() => {});
      console.error(`FAIL ${name}: ${error}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  await writeFile(`${artifacts}/tested-commit.txt`, process.env.GITHUB_SHA ?? "local");
  await browser?.close();
  server.kill("SIGTERM");
}
if (results.length !== 38 || results.some((result) => result.status !== "passed")) {
  throw new Error(
    `Performance design: ${results.filter((result) => result.status === "failed").length} failures across ${results.length}/38 views`,
  );
}
