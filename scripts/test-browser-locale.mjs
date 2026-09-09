import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit, expect } from "@playwright/test";
import { initializePageLocale } from "./browser-test-locale.mjs";
const output = path.join(process.cwd(), "test-results/browser-locale");
await mkdir(output, { recursive: true });
const server = createServer((request, response) => {
  response.setHeader("content-type", "text/html; charset=utf-8");
  if (request.url === "/frame") {
    response.end(
      `<p>Sandboxed platform frame</p><script>parent.postMessage({fixture:"opaque-frame-ready"},"*")</script>`,
    );
    return;
  }
  if (request.url === "/denied")
    response.setHeader("content-security-policy", "sandbox allow-scripts");
  response.end(
    `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><h1>Synthetic framing regression</h1><script>window.frameReady=false;addEventListener("message",e=>{if(e.data?.fixture==="opaque-frame-ready")window.frameReady=true})</script><iframe title="Platform sandbox" sandbox="allow-scripts" src="/frame"></iframe></body></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`,
  engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
let browser;
const results = [];
try {
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  for (const mode of ["former-unscoped", "scoped", "real-top-storage-denied"]) {
    const context = await browser.newContext();
    if (mode === "former-unscoped")
      await context.addInitScript(() => localStorage.setItem("forma_lang", "lt"));
    else await context.addInitScript(initializePageLocale, { origin, language: "lt" });
    const errors = [],
      page = await context.newPage();
    page.on("pageerror", (error) => errors.push({ name: error.name, message: error.message }));
    await page.goto(origin + (mode === "real-top-storage-denied" ? "/denied" : "/"));
    await expect(page.getByRole("heading", { name: "Synthetic framing regression" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.frameReady)).toBe(true);
    if (mode === "scoped") {
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => localStorage.getItem("forma_lang"))).toBe("lt");
    } else {
      expect(
        errors.some((error) =>
          /SecurityError|security|denied|insecure/i.test(error.name + error.message),
        ),
      ).toBe(true);
      if (mode === "former-unscoped")
        expect(await page.evaluate(() => localStorage.getItem("forma_lang"))).toBe("lt");
    }
    results.push({
      name: mode,
      status: "passed",
      observedPageErrors: errors.length,
      expectedErrors: mode !== "scoped",
    });
    console.log("PASS", mode, "observed errors:", errors.length);
    await context.close();
  }
} finally {
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real browser sandbox frame reproducer; expected error controls are intentional; no external app/data",
        engine,
        results,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
