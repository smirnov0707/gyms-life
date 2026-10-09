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
const out = path.join(root, "test-results/lab-availability", engine, "populated");
await mkdir(out, { recursive: true });
const results = [], errors = [];
const cases = [];
for (const lang of ["lt", "en"])
  for (const theme of ["dark", "light"])
    for (const width of [320, 390, 1280])
      for (const status of ["insufficient_evidence", "monitoring", "supported", "contradicted"])
        cases.push({ lang, theme, width, status, scale: 1 });
for (const lang of ["lt", "en"])
  for (const theme of ["dark", "light"])
    for (const width of [320, 1280])
      cases.push({ lang, theme, width, status: "monitoring", scale: 2 });
for (const theme of ["dark", "light"])
  for (const width of [320, 1280])
    cases.push({ lang: "de", theme, width, status: "supported", scale: 1 });
assert.equal(cases.length, 60);

const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/lab-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    ...["auth", "lab.functions", "forecast.functions", "personal-experiment.functions"].map(name => ({
      find: `@/lib/${name}`, replacement: path.join(root, "tests/lab-browser/services.ts"),
    })),
    { find: "@", replacement: path.join(root, "src") },
  ] },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react", "react-dom/client", "react/jsx-runtime", "@tanstack/react-query",
      "@tanstack/react-router", "use-sync-external-store/shim/with-selector.js",
      "zod", "lucide-react", "@radix-ui/react-slot", "class-variance-authority", "clsx", "tailwind-merge",
    ],
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
  for (const settings of cases) {
    const { lang, theme, width, status, scale } = settings;
    const name = `${engine}-${lang}-${theme}-${width}-${status}-text${scale}`;
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: lang === "lt" ? "lt-LT" : lang === "de" ? "de-DE" : "en-GB",
      timezoneId: "Europe/Vilnius", reducedMotion: "reduce",
    });
    await context.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET") return route.continue();
      errors.push(`${name}: unexpected ${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`${name}: ${error}`));
    page.on("console", message => { if (message.type() === "error") errors.push(`${name}: ${message.text()}`); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${name}: HTTP ${response.status()} ${response.url()}`); });
    try {
      await page.goto(`${origin}/index.html?view=deck&lang=${lang}&theme=${theme}&hypothesis=${status}`);
      const deck = page.locator("[data-lab-command-deck]");
      await expect(deck).toHaveAttribute("data-investigation-state", status, { timeout: 30000 });
      const card = deck.locator(".fl-investigation-card");
      const count = status === "insufficient_evidence" ? 2 : status === "monitoring" ? 3 : 6;
      await expect(card.getByText(`${count}/6`, { exact: true })).toBeVisible();
      const states = lang === "lt"
        ? { insufficient_evidence: "Renkami įrodymai", monitoring: "Stebima", supported: "Pagrįsta", contradicted: "Paneigta" }
        : { insufficient_evidence: "Gathering evidence", monitoring: "Monitoring", supported: "Supported", contradicted: "Contradicted" };
      await expect(card.getByText(states[status], { exact: true })).toBeVisible();
      const snapshot = () => page.evaluate(() => JSON.stringify(window.__labQueries.getQueryCache().getAll().find(q => q.queryKey[0] === "future-lab-overview")?.state.data));
      const before = await snapshot();
      assert.ok(before && before !== "undefined", "The actual query must be populated");
      const evidenceSummary = card.locator("details > summary").first();
      await expect(card.locator("[data-lab-evidence]")).toBeHidden();
      await evidenceSummary.focus();
      await page.keyboard.press("Enter");
      await expect(card.locator("[data-lab-evidence-row]")).toHaveCount(3);
      await expect(card.locator("[data-lab-evidence]")).toBeVisible();
      const sources = lang === "lt" ? ["Paties nurodyta", "Apskaičiuota", "Išmatuota"] : ["Self-reported", "Calculated", "Measured"];
      await expect(card.locator("[data-lab-evidence-source]")).toHaveText(sources);
      await expect(card.locator('[data-lab-evidence-row="rated_sessions_28d"] dd')).toHaveText("12");
      await expect(card.locator('[data-lab-evidence-row="usual_day_completion_rate_28d"] dd')).toHaveText(new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(0.625));
      await deck.locator("[data-lab-history-toggle]").click();
      await expect(deck.locator("[data-lab-history]")).toBeVisible();
      await expect(deck.locator("[data-lab-decision]")).toHaveCount(4);
      await expect(deck.locator("[data-lab-fit-rate]")).toContainText("100%");
      if (scale === 2) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.evaluate(() => document.fonts.ready);

      const audit = await deck.evaluate(el => {
        const rgba = value => {
          const context = document.createElement("canvas").getContext("2d");
          context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255);
        };
        const lum = rgb => rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const css = getComputedStyle(document.documentElement);
        const backgrounds = ["--background", "--surface", "--surface-2"].map(key => rgba(css.getPropertyValue(key)));
        const selector = "[data-lab-evidence-source],[data-lab-decision-meta],[data-lab-outcome],[data-lab-history-heading],[data-lab-read-label],.fl-investigation-card h2";
        const samples = [...el.querySelectorAll(selector)].filter(node => node.getClientRects().length).map(node => {
          const style = getComputedStyle(node);
          return { text: node.textContent, fontSize: parseFloat(style.fontSize), minContrast: Math.min(...backgrounds.map(bg => contrast(rgba(style.color), bg))), clipped: node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== "inline" };
        });
        const overlaps = [...el.querySelectorAll("[data-lab-evidence-row]")].map(row => {
          const a = row.querySelector("dt").getBoundingClientRect(), b = row.querySelector("dd").getBoundingClientRect();
          return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        });
        return { samples, overlaps, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.ok(audit.samples.length >= 15, "The readability check must inspect real populated text");
      for (const sample of audit.samples) {
        expect(sample.fontSize, `${name}: ${sample.text}`).toBeGreaterThanOrEqual(12 * scale - 0.1);
        expect(sample.minContrast, `${name}: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
        expect(sample.clipped, `${name}: ${sample.text}`).toBe(false);
      }
      for (const overlap of audit.overlaps) expect(overlap).toBeLessThanOrEqual(1);
      expect(audit.overflow).toBe(false);
      for (const summary of [evidenceSummary, deck.locator("[data-lab-history-toggle]")])
        expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await snapshot()).toBe(before);
      await page.screenshot({ path: path.join(out, `${name}-populated.png`), fullPage: true });

      await page.evaluate(async () => {
        window.__labHarness.setFailed(true);
        await window.__labQueries.invalidateQueries({ queryKey: ["future-lab-overview"] });
      });
      const stale = deck.locator('[data-lab-read-state="stale"]');
      await expect(stale).toBeVisible();
      await expect(deck).toHaveAttribute("data-investigation-state", status);
      await expect(card.locator("[data-lab-evidence-source]")).toHaveText(sources);
      expect(await snapshot()).toBe(before);
      if (status === "insufficient_evidence") await expect(card.locator('a[href="/app"]')).toHaveCount(0);
      await page.evaluate(() => window.__labHarness.setFailed(false));
      await stale.getByRole("button", { name: lang === "lt" ? "Pakartoti patikrą" : "Retry check", exact: true }).click();
      await expect(deck.locator("[data-lab-read-state]")).toHaveCount(0);
      await expect(card.getByText(`${count}/6`, { exact: true })).toBeVisible();
      expect(await snapshot()).toBe(before);
      results.push({ name, ...settings, status: "passed", hypothesisStatus: status, audit });
      console.log("PASS", name);
    } catch (error) {
      await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
      throw error;
    } finally { await context.close(); }
  }
  assert.equal(results.length, 60);
  assert.deepEqual(errors, []);
} catch (error) { failure = String(error); throw error; }
finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({ engine, expectedGroups: 60, results, errors, failure, scope: "Real active Lab component with all four hypothesis statuses, labelled synthetic sources and real query recovery. Root-font doubling is not browser/device zoom or screen-reader acceptance. Contrast samples are compared with the three solid theme grounds, not every composited pixel." }, null, 2));
  await browser?.close();
  await server.close();
}
