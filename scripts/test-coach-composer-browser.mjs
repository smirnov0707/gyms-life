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
const out = path.join(root, "test-results/coach-composer", engine);
await mkdir(out, { recursive: true });
const results = [],
  errors = [];
const service = path.join(root, "tests/coach-conversation-browser/services.ts");
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/coach-conversation-browser"),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      ...["auth", "plan.functions", "ai-personalization-consent.functions"].map((name) => ({
        find: `@/lib/${name}`,
        replacement: service,
      })),
      {
        find: /^@tanstack\/react-router$/,
        replacement: path.join(root, "tests/core-browser/router-stub.tsx"),
      },
      {
        find: /^@tanstack\/react-start(\/.*)?$/,
        replacement: path.join(root, "tests/today-browser/start-stub.ts"),
      },
      { find: "@", replacement: path.join(root, "src") },
    ],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "zod",
      "lucide-react",
      "sonner",
      "@radix-ui/react-slot",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
    ],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
let browser,
  failure = null;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  const open = async (params, width = 390) => {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "en-GB",
      timezoneId: "Europe/Vilnius",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && request.method() === "GET")
        return route.continue();
      errors.push(`Forbidden request ${request.method()} ${request.url()}`);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
    });
    await page.goto(`${origin}/index.html?${params}`);
    await expect(page.locator("[data-synthetic-conversation]")).toBeVisible({ timeout: 30000 });
    const conversation = page.locator(".fl-coach-conversation");
    return {
      page,
      context,
      conversation,
      draft: page.locator("[data-coach-draft]"),
      send: page.locator("[data-coach-send]"),
      turns: page.locator("[data-coach-messages] [data-coach-turn]"),
      retry: page.locator("[data-coach-history-retry]"),
    };
  };
  const settle = (page) =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  const counts = (page) =>
    page.evaluate(() => ({
      reads: window.__conversationTest.reads.length,
      sends: window.__conversationTest.sends.length,
      clears: window.__conversationTest.clears.length,
    }));
  for (const lang of ["lt", "en", "de"])
    for (const theme of ["dark", "light"])
      for (const width of [320, 390, 1280]) {
        const name = `${engine}-${lang}-${theme}-${width}`;
        const { page, context, conversation, draft, send, turns } = await open(
          `lang=${lang}&theme=${theme}`,
          width,
        );
        try {
          await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
          assert.equal(await draft.evaluate((el) => el.tagName), "TEXTAREA");
          await expect(draft).toHaveAttribute("aria-describedby", /.+-help/);
          await expect(page.locator("[data-coach-composer-help]")).toContainText(
            lang === "lt" ? "nauja eilutė" : "new line",
          );
          await expect
            .poll(() =>
              draft.evaluate((el) => {
                const style = getComputedStyle(el);
                return (
                  el.getBoundingClientRect().height >=
                  2 * parseFloat(style.lineHeight) +
                    parseFloat(style.paddingTop) +
                    parseFloat(style.paddingBottom)
                );
              }),
            )
            .toBe(true);
          const initial = await draft.boundingBox();
          assert.ok(initial && initial.height >= 44);
          await draft.fill("First line");
          await draft.press("End");
          await draft.press("Enter");
          await draft.pressSequentially("Second line");
          await draft.press("Shift+Enter");
          await draft.pressSequentially("Third line");
          await expect(draft).toHaveValue("First line\nSecond line\nThird line");
          assert.equal((await counts(page)).sends, 0);
          const lines = Array.from(
            { length: 14 },
            (_, index) =>
              `${index + 1}. ${lang === "lt" ? "Mano klausimas apie šiandieną" : "My question about today"}`,
          ).join("\n");
          await draft.fill(lines);
          await expect
            .poll(async () => (await draft.boundingBox()).height)
            .toBeGreaterThan(initial.height);
          const layout = await draft.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              height: el.getBoundingClientRect().height,
              line: parseFloat(style.lineHeight),
              padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
              overflowY: style.overflowY,
              client: el.clientHeight,
              scroll: el.scrollHeight,
              font: parseFloat(style.fontSize),
            };
          });
          assert.ok(layout.height <= layout.line * 6 + layout.padding + 2);
          assert.ok(layout.scroll > layout.client && layout.overflowY === "auto");
          assert.ok(layout.font >= 16);
          await expect(draft).toHaveValue(lines);
          if (width !== 1280)
            await page
              .locator("[data-coach-composer]")
              .screenshot({ path: path.join(out, `${name}-multiline.png`) });
          await draft.fill("Short");
          await expect
            .poll(async () => (await draft.boundingBox()).height)
            .toBeLessThanOrEqual(initial.height + 1);
          await draft.fill("x".repeat(1001));
          await expect(draft).toHaveValue("x".repeat(1001));
          await expect(draft).toHaveAttribute("aria-invalid", "true");
          await expect(send).toBeDisabled();
          await draft.press("Control+Enter");
          assert.equal((await counts(page)).sends, 0);
          await expect(page.locator("[data-coach-draft-count]")).toHaveText("1001 / 1000");
          const question =
            lang === "lt"
              ? "Kaip pakeisti treniruotę?\nŠiandien pavargau."
              : "How should I adapt training?\nI feel tired today.";
          await draft.fill(question);
          await expect(send).toBeEnabled();
          await draft.dispatchEvent("compositionstart");
          await draft.dispatchEvent("keydown", { key: "Enter", code: "Enter", ctrlKey: true });
          await draft.dispatchEvent("compositionend");
          await draft.dispatchEvent("keydown", {
            key: "Enter",
            code: "Enter",
            ctrlKey: true,
            isComposing: true,
          });
          await draft.dispatchEvent("keydown", {
            key: "Enter",
            code: "Enter",
            ctrlKey: true,
            keyCode: 229,
          });
          await draft.dispatchEvent("keydown", {
            key: "Enter",
            code: "Enter",
            ctrlKey: true,
            repeat: true,
          });
          assert.equal((await counts(page)).sends, 0);
          await expect(draft).toHaveValue(question);
          await page.evaluate(() => window.__conversationTest.setHold("send", true));
          await draft.press(width === 390 ? "Meta+Enter" : "Control+Enter");
          await expect(conversation).toHaveAttribute("data-coach-operation", "sending");
          await draft.press("Control+Enter");
          assert.equal((await counts(page)).sends, 1);
          await expect(send).toBeDisabled();
          await expect(draft).toHaveValue(question);
          const nextDraft = "Next draft\nKept while waiting";
          await draft.fill(nextDraft);
          await page.evaluate(() => {
            window.__conversationTest.setHold("send", false);
            window.__conversationTest.release("send");
          });
          await expect(conversation).toHaveAttribute("data-coach-operation", "idle");
          await expect(draft).toHaveValue(nextDraft);
          await expect(turns.filter({ hasText: question })).toHaveCount(2);
          const sent = await page.evaluate(() => window.__conversationTest.sends);
          assert.deepEqual(sent, [{ owner: "synthetic-a", question }]);
          await draft.focus();
          await page.keyboard.press("Tab");
          await expect(send).toBeFocused();
          await send.press("Enter");
          await expect.poll(async () => (await counts(page)).sends).toBe(2);
          await expect(draft).toHaveValue("");
          const form = page.locator("[data-coach-composer]");
          const metrics = await form.evaluate((el) => ({
            width: el.clientWidth,
            scroll: el.scrollWidth,
          }));
          assert.ok(metrics.scroll <= metrics.width + 1);
          const button = await send.boundingBox();
          assert.ok(
            button &&
              button.width >= 44 &&
              button.height >= 44 &&
              button.x >= 0 &&
              button.x + button.width <= width + 1,
          );
          results.push({ name, status: "passed", layout, metrics });
        } catch (error) {
          await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
          throw error;
        } finally {
          await context.close();
        }
      }
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [320, 390]) {
        const name = `${engine}-${lang}-${theme}-${width}-text2`;
        const { page, context, conversation, draft, send } = await open(
          `lang=${lang}&theme=${theme}`,
          width,
        );
        try {
          await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
          const value = Array.from({ length: 12 }, () => "Longer multiline question").join("\n");
          await draft.fill(value);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          await expect(page.locator("html")).toHaveCSS("font-size", "32px");
          await expect(draft).toHaveCSS("font-size", "32px");
          await expect
            .poll(() => draft.evaluate((el) => el.getBoundingClientRect().height))
            .toBeGreaterThan(290);
          await expect(draft).toHaveValue(value);
          const metrics = await page.locator("[data-coach-composer]").evaluate((el) => ({
            width: el.clientWidth,
            scroll: el.scrollWidth,
            box: el.getBoundingClientRect().toJSON(),
          }));
          assert.ok(metrics.scroll <= metrics.width + 1);
          const button = await send.boundingBox();
          assert.ok(button && button.x >= 0 && button.x + button.width <= width + 1);
          await page
            .locator("[data-coach-composer]")
            .screenshot({ path: path.join(out, `${name}.png`) });
          results.push({ name, status: "passed", metrics });
        } catch (error) {
          await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
          throw error;
        } finally {
          await context.close();
        }
      }
  {
    const { page, context, conversation, draft, send, retry } = await open("lang=lt&theme=light");
    try {
      await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
      const value = "Pirma eilutė\nAntra eilutė – neprarasti";
      await draft.fill(value);
      await page.evaluate(() => window.__conversationTest.loseReply("send", true));
      await draft.press("Control+Enter");
      await expect(page.locator("[data-coach-send-warning]")).toBeVisible();
      await expect(draft).toHaveValue(value);
      await draft.press("Control+Enter");
      await expect(send).toBeDisabled();
      assert.equal((await counts(page)).sends, 1);
      await retry.click();
      await expect(conversation).toHaveAttribute("data-coach-history-state", "ready");
      await expect(draft).toHaveValue(value);
      assert.equal((await counts(page)).sends, 1);
      await page.evaluate(() => window.__conversationTest.setOwner("synthetic-b"));
      await expect(draft).toHaveValue("");
      await page.evaluate(() => window.__conversationTest.setOwner(null));
      await expect(draft).toBeDisabled();
      await expect(send).toBeDisabled();
      results.push({
        name: "multiline ambiguous-send recovery and account isolation",
        status: "passed",
      });
    } finally {
      await context.close();
    }
  }
  assert.equal(results.length, 27);
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
        results,
        errors,
        failure,
        scope:
          "Actual Coach route/session with synthetic service boundaries. 18 default-size, 8 doubled-root text and one recovery/account case. No live AI, user records, real IME/device, clipboard or browser-zoom acceptance.",
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await server.close();
}
