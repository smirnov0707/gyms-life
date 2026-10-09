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
const out = path.join(root, "test-results/coach-conversation", engine);
await mkdir(out, { recursive: true });
const results = [], errors = [];
const service = path.join(root, "tests/coach-conversation-browser/services.ts");
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/coach-conversation-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    ...["auth", "plan.functions", "ai-personalization-consent.functions"].map(name => ({ find: `@/lib/${name}`, replacement: service })),
    { find: /^@tanstack\/react-router$/, replacement: path.join(root, "tests/core-browser/router-stub.tsx") },
    { find: /^@tanstack\/react-start(\/.*)?$/, replacement: path.join(root, "tests/today-browser/start-stub.ts") },
    { find: "@", replacement: path.join(root, "src") },
  ] },
  optimizeDeps: { noDiscovery: true, include: [
    "react", "react-dom/client", "react/jsx-runtime", "zod", "lucide-react", "sonner",
    "@radix-ui/react-slot", "class-variance-authority", "clsx", "tailwind-merge",
  ] },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser, failure = null;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  const open = async (params, width = 390) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: "en-GB", timezoneId: "Europe/Vilnius", reducedMotion: "reduce" });
    await context.route("**/*", route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET") return route.continue();
      errors.push(`Forbidden request ${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/index.html?${params}`);
    await expect(page.locator("[data-synthetic-conversation]")).toBeVisible({ timeout: 30000 });
    const conversation = page.locator(".fl-coach-conversation");
    return {
      page, context, conversation,
      draft: page.locator("[data-coach-draft]"),
      send: page.locator("[data-coach-send]"),
      turns: page.locator("[data-coach-messages] [data-coach-turn]"),
      retry: page.locator("[data-coach-history-retry]"),
    };
  };
  const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const counts = page => page.evaluate(() => ({ reads: window.__conversationTest.reads.length, sends: window.__conversationTest.sends.length, clears: window.__conversationTest.clears.length }));
  for (const lang of ["lt", "en", "de"]) for (const theme of ["dark", "light"]) for (const width of [320, 390, 1280]) {
    const name = `${engine}-${lang}-${theme}-${width}`;
    const h = await open(`fail=1&lang=${lang}&theme=${theme}`, width);
    const { page, context, conversation, draft, send, turns, retry } = h;
    try {
      await expect(conversation).toHaveAttribute("data-coach-history-state", "unavailable");
      await expect(page.locator("[data-coach-confirmed-empty]")).toHaveCount(0);
      await expect(page.locator("[data-memory-empty]")).toHaveCount(0);
      await expect(page.locator("[data-coach-history-status]")).toContainText(lang === "lt" ? "nepavyko" : "could not be read");
      await expect(retry).toHaveText(lang === "lt" ? "Patikrinti istoriją" : "Check history");
      const question = lang === "lt" ? "Kodėl šiandien siūlomas atsistatymas?" : "Why is recovery suggested today?";
      await draft.fill(question);
      if (width === 320) await conversation.screenshot({ path: path.join(out, `${name}-unknown.png`) });
      await page.evaluate(() => { window.__conversationTest.setReadFailure(false); window.__conversationTest.setHold("read", true); });
      const beforeRead = await counts(page);
      await retry.evaluate(el => { el.click(); el.click(); });
      await expect(retry).toBeDisabled();
      await expect.poll(async () => (await counts(page)).reads).toBe(beforeRead.reads + 1);
      await page.evaluate(() => { window.__conversationTest.setHold("read", false); window.__conversationTest.release("read"); });
      await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
      await expect(draft).toHaveValue(question);
      await page.evaluate(() => { window.__conversationTest.setHold("send", true); window.__conversationTest.loseReply("send", true); });
      await page.locator("[data-coach-composer]").evaluate(el => { el.requestSubmit(); el.requestSubmit(); });
      await expect(conversation).toHaveAttribute("data-coach-operation", "sending");
      await expect(draft).toHaveValue(question);
      await expect(send).toBeDisabled();
      assert.equal((await counts(page)).sends, 1);
      await page.evaluate(() => { window.__conversationTest.setHold("send", false); window.__conversationTest.release("send"); });
      await expect(page.locator("[data-coach-send-warning]")).toBeVisible();
      await expect(page.locator("[data-coach-retained-question]")).toHaveText(question);
      await expect(draft).toHaveValue(question);
      await expect(send).toBeDisabled();
      await expect(turns).toHaveCount(2);
      if (width === 390) await conversation.screenshot({ path: path.join(out, `${name}-unconfirmed.png`) });
      await retry.click();
      await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
      await expect(turns).toHaveCount(3);
      await expect(turns.last()).toHaveText(`Answer for ${question}`);
      await expect(draft).toHaveValue(question);
      await expect(send).toHaveAttribute("aria-label", lang === "lt" ? "Siųsti dar kartą" : "Send again");
      assert.equal((await counts(page)).sends, 1);
      await page.locator(".fl-luxury-disclosure > summary").click();
      await expect(page.locator("[data-memory-row]")).toHaveCount(3);
      await page.locator("[data-memory-clear]").click();
      await expect(page.locator("[data-memory-confirm]")).toBeVisible();
      await page.locator("[data-memory-confirm]").getByRole("button", { name: lang === "lt" ? "Atšaukti" : "Cancel", exact: true }).click();
      assert.equal((await counts(page)).clears, 0);
      await draft.fill(lang === "lt" ? "Naujas neišsiųstas klausimas" : "A new unsent question");
      const unsent = await draft.inputValue();
      await page.locator("[data-memory-clear]").click();
      await page.evaluate(() => window.__conversationTest.setHold("clear", true));
      await page.locator("[data-memory-confirm-clear]").evaluate(el => { el.click(); el.click(); });
      await expect(conversation).toHaveAttribute("data-coach-operation", "clearing");
      await expect(send).toBeDisabled();
      await expect(turns).toHaveCount(3);
      assert.equal((await counts(page)).clears, 1);
      await page.evaluate(() => { window.__conversationTest.setHold("clear", false); window.__conversationTest.release("clear"); });
      await expect(turns).toHaveCount(0);
      await expect(page.locator("[data-memory-row]")).toHaveCount(0);
      await expect(page.locator("[data-memory-empty]")).toBeVisible();
      await expect(page.locator("[data-coach-confirmed-empty]")).toBeVisible();
      await expect(draft).toHaveValue(unsent);
      const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, buttonHeight: document.querySelector("[data-coach-send]").getBoundingClientRect().height }));
      assert.ok(metrics.overflow <= 1 && metrics.buttonHeight >= 44);
      if (width === 320) await page.locator("[data-coach-memory]").screenshot({ path: path.join(out, `${name}-cleared.png`) });
      results.push({ name, status: "passed", metrics, counts: await counts(page) });
    } catch (error) {
      await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
      throw error;
    } finally { await context.close(); }
  }
  {
    const h = await open("hold=1");
    try {
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "loading");
      await h.draft.fill("New before history"); await h.send.click();
      await expect(h.turns).toHaveText(["New before history", "Answer for New before history"]);
      await h.page.evaluate(() => { window.__conversationTest.setHold("read", false); window.__conversationTest.release("read"); });
      await settle(h.page);
      await expect(h.turns).toHaveText(["New before history", "Answer for New before history"]);
      await h.retry.click();
      await expect(h.turns).toHaveText(["Earlier A answer", "New before history", "Answer for New before history"]);
      assert.equal((await counts(h.page)).sends, 1);
      results.push({ name: "initial snapshot arriving after send cannot erase current turns", status: "passed" });
    } finally { await h.context.close(); }
  }
  {
    const h = await open("");
    try {
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "ready");
      await h.page.evaluate(() => window.__conversationTest.setHold("send", true));
      await h.draft.fill("First question"); await h.send.click(); await h.draft.fill("Second unfinished draft");
      await h.page.evaluate(() => window.__conversationTest.release("send"));
      await expect(h.turns.last()).toHaveText("Answer for First question");
      await expect(h.draft).toHaveValue("Second unfinished draft");
      results.push({ name: "late answer does not clear a newer draft", status: "passed" });
    } finally { await h.context.close(); }
  }
  {
    const h = await open("hold=1");
    try {
      await h.draft.fill("Private A draft");
      await h.page.evaluate(() => window.__conversationTest.setOwner("synthetic-b"));
      await expect.poll(async () => (await counts(h.page)).reads).toBe(2);
      await expect(h.draft).toHaveValue("");
      await h.page.evaluate(() => window.__conversationTest.release("read", "synthetic-b"));
      await expect(h.turns).toHaveText(["Private B answer"]);
      await h.page.evaluate(() => window.__conversationTest.release("read", "synthetic-a"));
      await settle(h.page); await expect(h.turns).toHaveText(["Private B answer"]);
      results.push({ name: "account changes isolate late history and drafts", status: "passed" });
    } finally { await h.context.close(); }
  }
  {
    const h = await open("");
    try {
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "ready");
      await h.page.evaluate(() => window.__conversationTest.setHold("send", true));
      await h.draft.fill("Private pending question"); await h.send.click();
      await h.page.evaluate(() => window.__conversationTest.setOwner(null));
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "signed_out");
      await h.page.evaluate(() => window.__conversationTest.release("send"));
      await settle(h.page); await expect(h.turns).toHaveCount(0); await expect(h.draft).toHaveValue("");
      await expect(h.send).toBeDisabled();
      assert.equal((await counts(h.page)).sends, 1);
      results.push({ name: "sign-out ignores late send result without replay", status: "passed" });
    } finally { await h.context.close(); }
  }
  {
    const h = await open("");
    try {
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "ready");
      await h.page.locator(".fl-luxury-disclosure > summary").click();
      await h.page.evaluate(() => window.__conversationTest.loseReply("clear", true));
      await h.page.locator("[data-memory-clear]").click(); await h.page.locator("[data-memory-confirm-clear]").click();
      await expect(h.page.locator("[data-coach-clear-warning]")).toBeVisible();
      await expect(h.turns).toHaveCount(1); await expect(h.page.locator("[data-memory-row]")).toHaveCount(1);
      await expect(h.page.locator("[data-memory-clear]")).toBeDisabled();
      await h.retry.click(); await expect(h.turns).toHaveCount(0);
      await expect(h.page.locator("[data-memory-row]")).toHaveCount(0);
      assert.equal((await counts(h.page)).clears, 1);
      results.push({ name: "lost clear acknowledgement recovers by reading, not deleting again", status: "passed" });
    } finally { await h.context.close(); }
  }
  {
    const h = await open("strict=1&hold=1");
    try {
      await expect.poll(async () => (await counts(h.page)).reads).toBeGreaterThanOrEqual(2);
      await h.page.evaluate(() => window.__conversationTest.release("read"));
      await expect(h.conversation).toHaveAttribute("data-coach-history-state", "ready");
      await expect(h.turns).toHaveCount(1);
      assert.equal((await counts(h.page)).sends, 0); assert.equal((await counts(h.page)).clears, 0);
      results.push({ name: "StrictMode cleanup and restart never replay mutations", status: "passed" });
    } finally { await h.context.close(); }
  }
  assert.equal(results.length, 24);
  assert.deepEqual(errors, []);
} catch (error) { failure = String(error); throw error; }
finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({ engine, results, errors, failure, expectedGroups: 24, scope: "Actual Coach route, shared journal and privacy card with synthetic transport/auth adapters. No external requests or real AI/consent/deletion operations. No durable/cross-tab idempotency claim." }, null, 2));
  await browser?.close(); await server.close();
}
