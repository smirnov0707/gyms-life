import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.LAB_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine));
const out = path.join(root, "test-results/lab-availability", engine, "reflow");
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/lab-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      ...["auth", "lab.functions", "forecast.functions", "personal-experiment.functions"].map(
        (name) => ({
          find: `@/lib/${name}`,
          replacement: path.join(root, "tests/lab-browser/services.ts"),
        }),
      ),
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
      "@tanstack/react-router",
      "use-sync-external-store/shim/with-selector.js",
      "zod",
      "lucide-react",
      "@radix-ui/react-slot",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser;
let failure = null;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [320, 390]) {
        const name = `${engine}-${lang}-${theme}-${width}-text2`;
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          locale: lang === "lt" ? "lt-LT" : "en-GB",
          timezoneId: "Europe/Vilnius",
          reducedMotion: "reduce",
        });
        await context.route("**/*", (route) => {
          const request = route.request();
          if (new URL(request.url()).origin === origin && request.method() === "GET")
            return route.continue();
          errors.push(`${name}: unexpected ${request.method()} ${request.url()}`);
          return route.abort();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${name}: ${error}`));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(`${name}: ${message.text()}`);
        });
        page.on("response", (response) => {
          if (response.status() >= 400)
            errors.push(`${name}: HTTP ${response.status()} ${response.url()}`);
        });
        try {
          await page.goto(
            `${origin}/index.html?view=deck&lang=${lang}&theme=${theme}&hypothesis=monitoring`,
          );
          const deck = page.locator("[data-lab-command-deck]");
          await expect(deck).toHaveAttribute("data-investigation-state", "monitoring", {
            timeout: 30000,
          });
          const card = deck.locator(".fl-investigation-card");
          const summary = card.locator("details > summary").first();
          await summary.focus();
          await page.keyboard.press("Enter");
          await expect(card.locator("[data-lab-evidence]")).toBeVisible();
          await deck.locator("[data-lab-history-toggle]").click();
          await expect(deck.locator("[data-lab-fit-rate]")).toBeVisible();
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("html")).toHaveCSS("font-size", "32px");
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const count = card.getByText("3/6", { exact: true });
          await expect(count).toHaveCount(1);
          const countLines = await count.evaluate((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return [...range.getClientRects()]
              .filter((rect) => rect.width > 0)
              .map((rect) => rect.top);
          });
          assert.ok(countLines.length > 0, "The evidence count must have visible text");
          assert.ok(
            Math.max(...countLines) - Math.min(...countLines) < 1,
            `${name}: split evidence count`,
          );
          const audit = await deck.evaluate((el) => {
            const targets = [
              el.querySelector(".fl-investigation-card h2"),
              el.querySelector(".fl-investigation-card details > summary span"),
              el.querySelector("[data-lab-fit-rate] > span"),
            ];
            const words = [];
            for (const target of targets) {
              if (!target) throw new Error("Missing heading, disclosure or fit label");
              const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                for (const match of node.textContent.matchAll(/[\p{L}\p{N}]+/gu)) {
                  const range = document.createRange();
                  range.setStart(node, match.index);
                  range.setEnd(node, match.index + match[0].length);
                  const tops = [...range.getClientRects()]
                    .filter((rect) => rect.width > 0)
                    .map((rect) => rect.top);
                  words.push({
                    text: match[0],
                    lines: tops.length ? (Math.max(...tops) - Math.min(...tops) < 1 ? 1 : 2) : 0,
                  });
                }
              }
            }
            return {
              words,
              rootFontSize: getComputedStyle(document.documentElement).fontSize,
              headingFontSize: parseFloat(getComputedStyle(targets[0]).fontSize),
              summaryFontSize: parseFloat(getComputedStyle(targets[1]).fontSize),
              fitLabelFontSize: parseFloat(getComputedStyle(targets[2]).fontSize),
              theme: document.documentElement.className,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          await writeFile(
            path.join(out, `${name}-audit.json`),
            JSON.stringify({ ...audit, countLines }, null, 2),
          );
          assert.equal(audit.rootFontSize, "32px");
          assert.ok(
            audit.theme.split(/\s+/).includes(theme),
            "The requested theme must be applied",
          );
          assert.ok(
            audit.headingFontSize >= 25.9 && audit.summaryFontSize >= 25.9,
            "Do not shrink text to make it fit",
          );
          assert.ok(audit.fitLabelFontSize >= 23.9, "Do not shrink the fit label");
          assert.ok(audit.words.length >= 6, "Inspect real heading, disclosure and fit words");
          assert.deepEqual(
            audit.words.filter((word) => word.lines !== 1),
            [],
            `${name}: fragmented words`,
          );
          assert.equal(audit.overflow, false);
          assert.ok((await summary.boundingBox()).height >= 44);
          await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
          results.push({ name, status: "passed", audit, countLines });
        } catch (error) {
          await page.screenshot({
            path: path.join(out, `${name}-failure.png`),
            fullPage: true,
          });
          throw error;
        } finally {
          await context.close();
        }
      }
  assert.equal(results.length, 8);
  assert.deepEqual(errors, []);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        engine,
        expectedGroups: 8,
        results,
        errors,
        failure,
        scope:
          "Synthetic active Lab at doubled root font: intact heading/disclosure/fit words and evidence fraction. Not device zoom or screen-reader certification.",
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await server.close();
}
