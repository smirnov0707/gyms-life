import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const engine = process.env.COACH_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine));
const out = path.join(root, "test-results/coach-consent", engine);
await mkdir(out, { recursive: true });
const results = [], errors = [];
const service = path.join(root, "tests/coach-browser/services.ts");
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/coach-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    ...["auth", "plan.functions", "ai-personalization-consent.functions"].map((name) => ({
      find: `@/lib/${name}`, replacement: service,
    })),
    { find: /^@tanstack\/react-router$/, replacement: path.join(root, "tests/core-browser/router-stub.tsx") },
    { find: /^@tanstack\/react-start(\/.*)?$/, replacement: path.join(root, "tests/today-browser/start-stub.ts") },
    { find: "@", replacement: path.join(root, "src") },
  ] },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "react/jsx-runtime", "zod", "lucide-react", "sonner", "@radix-ui/react-slot", "class-variance-authority", "clsx", "tailwind-merge"],
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
    const context = await browser.newContext({
      viewport: { width, height: 900 }, locale: "en-GB", reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET") return route.continue();
      errors.push(`Forbidden ${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.locator("[data-synthetic-coach]")).toBeVisible({ timeout: 30000 });
    await page.locator(".fl-luxury-disclosure > summary").click();
    const card = page.locator("[data-coach-consent]");
    await expect(card).toBeVisible();
    return { page, context, card, action: card.locator("[data-consent-action]") };
  };
  for (const lang of ["lt", "en", "de"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 390, 1280]) {
        const name = `${engine}-${lang}-${theme}-${width}`;
        const { page, context, card, action } = await open(`fail=1&lang=${lang}&theme=${theme}`, width);
        try {
          const lt = lang === "lt";
          const enabled = lt ? "Asmeninis kontekstas įjungtas" : "Personal context enabled";
          const disabled = lt ? "Naudojami tik baziniai treniruočių nustatymai" : "Using basic training preferences only";
          const retry = lt ? "Patikrinti dabartinį pasirinkimą" : "Check current preference";
          await expect(card).toHaveAttribute("data-consent-state", "unavailable");
          await expect(action).toHaveText(retry);
          await expect(card.locator("[data-consent-status]")).not.toHaveText(enabled);
          await expect(card.locator("[data-consent-status]")).not.toHaveText(disabled);
          await expect(card.locator("[data-consent-explanation]")).toBeVisible();
          assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 0);
          const bounds = await action.boundingBox();
          assert.ok(bounds && bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          const metrics = await card.evaluate((el) => ({
            font: parseFloat(getComputedStyle(el.querySelector("[data-consent-status]")).fontSize),
            overflow: el.scrollWidth - el.clientWidth,
          }));
          assert.ok(metrics.font >= 13.9 && metrics.overflow <= 1);
          if (width !== 1280) await card.screenshot({ path: path.join(out, `${name}-unknown.png`) });
          await page.evaluate(() => { window.__consentTest.readable(); window.__consentTest.holdReads(true); });
          const before = await page.evaluate(() => window.__consentTest.reads.length);
          await action.evaluate((el) => { el.click(); el.click(); });
          await expect(card).toHaveAttribute("data-consent-state", "loading");
          await expect(action).toBeDisabled();
          assert.equal(await page.evaluate(() => window.__consentTest.reads.length), before + 1);
          assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 0);
          await page.evaluate(() => { window.__consentTest.holdReads(false); window.__consentTest.releaseReads(); });
          await expect(card).toHaveAttribute("data-consent-state", "ready");
          await expect(card.locator("[data-consent-status]")).toHaveText(enabled);
          await page.evaluate(() => window.__consentTest.holdWrites(true));
          await action.evaluate((el) => { el.click(); el.click(); });
          await expect(card).toHaveAttribute("data-consent-state", "saving");
          await expect(action).toBeDisabled();
          assert.deepEqual(await page.evaluate(() => window.__consentTest.writes), [{ owner: "synthetic-a", granted: false }]);
          await expect(card.locator("[data-consent-status]")).not.toHaveText(disabled);
          await page.evaluate(() => { window.__consentTest.holdWrites(false); window.__consentTest.releaseWrites(); });
          await expect(card.locator("[data-consent-status]")).toHaveText(disabled);
          await page.evaluate(() => window.__consentTest.loseReply(true));
          await action.click();
          await expect(card).toHaveAttribute("data-consent-state", "unavailable");
          await expect(card.locator("[data-consent-status]")).toContainText(lt ? "jau galėjo" : "may already");
          await expect(action).toHaveText(retry);
          assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 2);
          await action.click();
          await expect(card.locator("[data-consent-status]")).toHaveText(enabled);
          assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 2);
          if (width === 390) await card.screenshot({ path: path.join(out, `${name}-confirmed.png`) });
          results.push({ name, status: "passed", metrics });
        } catch (error) {
          await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
          throw error;
        } finally { await context.close(); }
      }
    }
  }
  {
    const { page, context, card } = await open("hold=1");
    try {
      await expect(card).toHaveAttribute("data-consent-state", "loading");
      await page.evaluate(() => window.__consentTest.setOwner("synthetic-b"));
      await expect.poll(() => page.evaluate(() => window.__consentTest.reads.length)).toBe(2);
      await page.evaluate(() => window.__consentTest.releaseReads("synthetic-b"));
      await expect(card.locator("[data-consent-status]")).toHaveText("Using basic training preferences only");
      await page.evaluate(() => window.__consentTest.releaseReads("synthetic-a"));
      await expect(card.locator("[data-consent-status]")).toHaveText("Using basic training preferences only");
      results.push({ name: "late prior-owner read cannot replace current preference", status: "passed" });
    } finally { await context.close(); }
  }
  {
    const { page, context, card, action } = await open("");
    try {
      await expect(card).toHaveAttribute("data-consent-state", "ready");
      await page.evaluate(() => window.__consentTest.holdWrites(true));
      await action.click();
      await expect(card).toHaveAttribute("data-consent-state", "saving");
      await page.evaluate(() => window.__consentTest.setOwner(null));
      await expect(card).toHaveAttribute("data-consent-state", "signed_out");
      await expect(card.locator("[data-consent-action]")).toHaveCount(0);
      await page.evaluate(() => window.__consentTest.releaseWrites());
      await expect(card).toHaveAttribute("data-consent-state", "signed_out");
      assert.equal(await page.evaluate(() => window.__consentTest.reads.length), 1);
      assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 1);
      results.push({ name: "sign-out isolates an earlier in-flight write", status: "passed" });
    } finally { await context.close(); }
  }
  {
    const { page, context, card } = await open("strict=1&hold=1");
    try {
      await expect(card).toHaveAttribute("data-consent-state", "loading");
      await expect.poll(() => page.evaluate(() => window.__consentTest.reads.length)).toBeGreaterThanOrEqual(2);
      await page.evaluate(() => window.__consentTest.releaseReads());
      await expect(card.locator("[data-consent-status]")).toHaveText("Personal context enabled");
      assert.equal(await page.evaluate(() => window.__consentTest.writes.length), 0);
      results.push({ name: "StrictMode cleanup/restart still resolves the mounted session", status: "passed" });
    } finally { await context.close(); }
  }
  assert.equal(results.length, 21);
  assert.deepEqual(errors, []);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({
    engine, results, errors, failure,
    scope: "Actual Coach route and privacy card; synthetic auth/server-function transport adapters. No live consent, AI, history deletion, account or physical-device actions.",
  }, null, 2));
  await browser?.close();
  await server.close();
}
