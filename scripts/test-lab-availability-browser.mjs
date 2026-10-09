import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.LAB_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine), "Unsupported Lab browser");
const out = path.join(root, "test-results/lab-availability", engine);
await mkdir(out, { recursive: true });
const results = [], errors = [];
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/lab-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: "@/lib/auth", replacement: path.join(root, "tests/lab-browser/services.ts") },
    { find: "@/lib/lab.functions", replacement: path.join(root, "tests/lab-browser/services.ts") },
    { find: "@", replacement: path.join(root, "src") },
  ] },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "react/jsx-runtime", "@tanstack/react-query", "zod", "lucide-react", "@radix-ui/react-slot", "class-variance-authority", "clsx", "tailwind-merge"],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser, failure = null;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  const open = async (query, width = 390) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: "en-GB", timezoneId: "Europe/Vilnius", reducedMotion: "reduce" });
    await context.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET") return route.continue();
      errors.push(`Unexpected request ${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-lab")).toBeVisible({ timeout: 30000 });
    return { context, page };
  };
  const count = page => page.evaluate(() => window.__labHarness.requests.length);
  const finish = page => page.evaluate(() => { window.__labHarness.setHeld(false); window.__labHarness.release(); });
  const readableNext = page => page.evaluate(() => { window.__labHarness.setFailed(false); window.__labHarness.setReadable(); });
  const retryName = lt => lt ? "Pakartoti patikrą" : "Retry check";
  const historyName = lt => lt ? "Sprendimų istorija ir atitikimas" : "Decision history & fit";

  for (const lang of ["lt", "en", "de"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 1280]) {
        const name = `${engine}-${lang}-${theme}-${width}`;
        const lt = lang === "lt";
        const { page, context } = await open(`source=decision_outcomes&lang=${lang}&theme=${theme}`, width);
        try {
          const notice = page.locator('[data-lab-read-state="partial"]');
          await expect(notice).toBeVisible();
          await expect(page.locator("[data-lab-history]")).toHaveCount(0);
          await expect(notice.locator("[data-lab-unreadable-sources]")).toContainText(lt ? "atsakymai į sprendimus" : "decision responses");
          await page.getByRole("button", { name: historyName(lt), exact: true }).click();
          await expect(page.locator("[data-lab-decision]")).toHaveCount(4);
          await expect(page.locator("[data-lab-fit-unavailable]")).toBeVisible();
          await expect(page.locator("[data-lab-fit-rate]")).toHaveCount(0);
          await expect(page.locator("[data-lab-outcome]").last()).toHaveText(lt ? "Atsakymo patikrinti nepavyko" : "Response could not be verified");
          await expect(page.locator("[data-lab-outcome]").first()).toHaveText(lt ? "Atlikta" : "Completed");
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
          const retry = page.getByRole("button", { name: retryName(lt), exact: true });
          const bounds = await retry.boundingBox();
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
          expect(await notice.locator("[data-system-notice]").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
          if (width === 320) await page.screenshot({ path: path.join(out, `${name}-partial.png`), fullPage: true });

          await readableNext(page);
          await page.evaluate(() => window.__labHarness.setHeld(true));
          const before = await count(page);
          await retry.evaluate(el => { el.click(); el.click(); });
          await expect.poll(() => count(page)).toBe(before + 1);
          await expect(notice.getByRole("button")).toBeDisabled();
          await expect(page.locator("[data-lab-history]")).toBeVisible();
          await finish(page);
          await expect(page.locator("[data-lab-read-state]")).toHaveCount(0);
          await expect(page.locator("[data-lab-fit-rate]")).toContainText("100%");
          await expect(page.locator("[data-lab-outcome]").last()).toHaveText(lt ? "Dar be atsakymo" : "No response yet");

          await page.evaluate(async () => {
            window.__labHarness.setFailed(true);
            await window.__labQueries.invalidateQueries({ queryKey: ["future-lab-overview"] });
          });
          const stale = page.locator('[data-lab-read-state="stale"]');
          await expect(stale).toBeVisible();
          await expect(page.locator("[data-lab-fit-rate]")).toContainText("100%");
          await expect(page.locator("[data-lab-decision]")).toHaveCount(4);
          await page.evaluate(() => window.__labHarness.setHeld(true));
          await stale.getByRole("button", { name: retryName(lt), exact: true }).click();
          await expect(stale.getByRole("button")).toBeDisabled();
          await expect(page.locator("[data-lab-history]")).toBeVisible();
          await finish(page);
          await expect(stale.getByRole("button", { name: retryName(lt), exact: true })).toBeEnabled();
          await readableNext(page);
          await stale.getByRole("button", { name: retryName(lt), exact: true }).click();
          await expect(page.locator("[data-lab-read-state]")).toHaveCount(0);
          results.push({ name, status: "passed", checks: "visible partial notice, truthful outcome/rate, one retry per request, retained cached history, failed retry, recovery, layout and reduced motion" });
        } catch (error) {
          await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
          throw error;
        } finally { await context.close(); }
      }
    }
  }
  {
    const { page, context } = await open("scenario=unavailable&lang=lt&theme=light");
    try {
      await expect(page.locator('[data-lab-read-state="unavailable"]')).toBeVisible();
      await expect(page.locator("[data-lab-overview]")).toHaveCount(0);
      await readableNext(page);
      await page.getByRole("button", { name: retryName(true), exact: true }).click();
      await expect(page.locator("[data-lab-overview]")).toBeVisible();
      expect(await count(page)).toBe(2);
      results.push({ name: "initial failure to successful explicit retry", status: "passed" });
    } finally { await context.close(); }
  }
  {
    const { page, context } = await open("source=decisions&lang=en&theme=dark");
    try {
      await expect(page.locator('[data-lab-read-state="partial"]')).toBeVisible();
      await page.getByRole("button", { name: historyName(false), exact: true }).click();
      await expect(page.locator("[data-lab-decisions]")).toContainText("Decision history could not be read.");
      await expect(page.getByText("No Today decisions in the last 14 days.", { exact: true })).toHaveCount(0);
      await page.evaluate(() => window.__labHarness.setReadable(true));
      await page.getByRole("button", { name: retryName(false), exact: true }).click();
      await expect(page.locator("[data-lab-read-state]")).toHaveCount(0);
      await expect(page.locator("[data-lab-decisions]")).toContainText("No Today decisions in the last 14 days.");
      results.push({ name: "unreadable empty history differs from confirmed empty history", status: "passed" });
    } finally { await context.close(); }
  }
  {
    const { page, context } = await open("lang=en&theme=light");
    try {
      await expect(page.locator("[data-lab-overview]")).toBeVisible();
      await page.evaluate(() => {
        window.__labHarness.setReadable(true);
        window.__labHarness.setHeld(true);
        window.__labHarness.setOwner("10000000-0000-4000-8000-000000000002");
      });
      await expect(page.locator('[data-lab-read-state="loading"]')).toBeVisible();
      await expect(page.locator("[data-lab-overview]")).toHaveCount(0);
      const afterSwitch = await count(page);
      await page.evaluate(() => window.__labHarness.setOwner(null));
      await finish(page);
      await expect(page.locator("[data-lab-overview]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: retryName(false), exact: true })).toHaveCount(0);
      expect(await count(page)).toBe(afterSwitch);
      results.push({ name: "account switch and sign-out do not render another owner's cached history", status: "passed" });
    } finally { await context.close(); }
  }
  assert.equal(results.length, 15);
  assert.deepEqual(errors, []);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({ engine, expectedGroups: 15, results, errors, failure, scope: "Real Lab components and React Query with synthetic authenticated service boundaries; no live account, DB or physical-device acceptance." }, null, 2));
  await browser?.close();
  await server.close();
}
