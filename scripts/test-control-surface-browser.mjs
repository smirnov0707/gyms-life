import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.CONTROL_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown control browser engine");
const artifacts = path.join(root, "test-results/control-surface", engine);
await mkdir(artifacts, { recursive: true });
const results = [];
const errors = [];
let browser;
let failure = null;
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/control-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(root, "src") } },
  server: { host: "127.0.0.1", port: 4189, strictPort: true, fs: { allow: [root] } },
});
const matchesToken = (locator, property, token) =>
  locator.evaluate(
    (element, { property, token }) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      element.parentElement.append(probe);
      const expected = getComputedStyle(probe).color;
      const actual = getComputedStyle(element)[property];
      probe.remove();
      return { actual, expected };
    },
    { property, token },
  );
try {
  await server.listen();
  const origin = "http://127.0.0.1:4189";
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 1280]) {
      for (const motion of ["reduce", "no-preference"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          locale: "en-GB",
          timezoneId: "Europe/Vilnius",
          hasTouch: width < 600,
          isMobile: width < 600,
          reducedMotion: motion,
        });
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin === origin && route.request().method() === "GET") return route.continue();
          errors.push(`Unexpected request: ${route.request().method()} ${url.origin}${url.pathname}`);
          return route.abort();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("response", (response) => {
          if (response.status() >= 400)
            errors.push(`Failed asset: ${response.status()} ${new URL(response.url()).pathname}`);
        });
        try {
          await page.goto(`${origin}/index.html?theme=${theme}`);
          await expect(page.getByRole("heading", { name: "One control language." })).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const input = page.getByRole("textbox", { name: "Amount", exact: true });
          await page.keyboard.press("Tab");
          await expect(input).toBeFocused();
          const outline = await input.evaluate((el) => getComputedStyle(el).outlineWidth);
          expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
          const fieldColor = await matchesToken(input, "color", "--foreground");
          expect(fieldColor.actual).toBe(fieldColor.expected);
          const headingColor = await matchesToken(
            page.locator(".gl-system-notice__title"),
            "color",
            "--foreground",
          );
          expect(headingColor.actual).toBe(headingColor.expected);
          await input.fill("5.5");
          await page.getByRole("textbox", { name: "Notes", exact: true }).fill("Local test only");
          const primary = page.getByRole("button", {
            name: "Sukurti mano individualų treniruočių planą",
            exact: true,
          });
          const compact = page.getByRole("button", { name: "Select mode", exact: true });
          for (const control of [primary, input, page.getByRole("button", { name: "Open instrument" })]) {
            const box = await control.boundingBox();
            expect(box).not.toBeNull();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
          }
          const compactBox = await compact.boundingBox();
          expect(compactBox.height).toBeGreaterThanOrEqual(width < 600 ? 44 : 36);
          expect(await primary.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
          expect(await primary.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
          await primary.click();
          await expect(page.getByLabel("Local submissions")).toHaveText("1");
          await compact.click();
          await expect(compact).toHaveAttribute("aria-pressed", "true");
          const disabled = page.getByRole("button", { name: "Unavailable action" });
          await expect(disabled).toBeDisabled();
          await disabled.evaluate((el) => el.click());
          await expect(page.getByLabel("Local submissions")).toHaveText("1");
          await page.getByRole("button", { name: "Focus amount", exact: true }).click();
          await expect(input).toBeFocused();
          const invalid = page.getByLabel("Explicit validation state");
          await invalid.focus();
          const invalidColor = await matchesToken(invalid, "outlineColor", "--destructive");
          expect(invalidColor.actual).toBe(invalidColor.expected);
          await expect(page.getByLabel("Read-only value")).toHaveJSProperty("readOnly", true);
          if (motion === "reduce") {
            await compact.hover();
            await compact.focus();
            await page.keyboard.down("Space");
            expect(await compact.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
            expect(await compact.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
            await page.keyboard.up("Space");
          } else if (width === 1280) {
            await compact.hover();
            await page.mouse.down();
            await expect.poll(() => compact.evaluate((el) => {
              const transform = getComputedStyle(el).transform;
              return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
            })).toBe(1);
            await page.mouse.up();
          }
          await page.getByRole("link", { name: "Open details" }).click();
          await expect(page).toHaveURL(/#details$/);
          await expect(page.getByLabel("Local submissions")).toHaveText("1");
          if (motion === "reduce") {
            await page.screenshot({ path: path.join(artifacts, `controls-${theme}-${width}.png`), fullPage: true });
          }
          const name = `${engine} ${theme} ${width}px ${motion}`;
          results.push({ name, status: "passed" });
          console.log("PASS", name);
        } finally {
          await context.close();
        }
      }
    }
  }
  if (results.length !== 12 || errors.length)
    throw new Error(`Control acceptance incomplete: ${JSON.stringify({ results: results.length, errors })}`);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify({
    engine,
    source: process.env.GITHUB_SHA ?? null,
    expectedGroups: 12,
    results,
    errors,
    failure,
    scope: "Real shared controls and production CSS with local synthetic interactions. No account, backend mutation or physical-device acceptance.",
  }, null, 2));
}
