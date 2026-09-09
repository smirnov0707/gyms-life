import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, webkit, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  file = (name) => path.join(root, "tests/night-review-browser", name),
  out = path.join(root, "test-results/night-review-browser");
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: file(""),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/integrations/supabase/client",
        replacement: path.join(root, "tests/offline-browser/client.ts"),
      },
      { find: "@/lib/brief.functions", replacement: file("functions.ts") },
      { find: "@/lib/night-lab.functions", replacement: file("functions.ts") },
      {
        find: /^@tanstack\/react-start(?:\/.*)?$/,
        replacement: path.join(root, "tests/today-browser/start-stub.ts"),
      },
      {
        find: /^@tanstack\/react-router$/,
        replacement: path.join(root, "tests/auth-browser/router.tsx"),
      },
      { find: "@", replacement: path.join(root, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "zod",
      "lucide-react",
      "sonner",
    ],
  },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [],
  errors = [];
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`,
    engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown engine");
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  const open = async (query = "", width = 390) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      timezoneId: "Europe/Vilnius",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      return u.origin === origin || ["data:", "blob:"].includes(u.protocol)
        ? route.continue()
        : route.abort();
    });
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-night")).toBeVisible();
    return { page, context };
  };
  for (const [mode, text] of [
    ["none", "No confirmed overnight review yet"],
    ["unavailable", "The review record is unavailable"],
    ["blocked", "An unconfirmed athlete state was not used"],
    ["partial", "Prediction review is unconfirmed"],
    ["invalid", "The review record is unavailable"],
    ["stale", "Earlier day's record"],
  ]) {
    const { page, context } = await open("mode=" + mode);
    await expect(page.getByText(text, { exact: false })).toBeVisible();
    if (["none", "unavailable", "blocked", "partial", "invalid"].includes(mode))
      await expect(page.getByText("Prediction records evaluated", { exact: false })).toHaveCount(0);
    await page.screenshot({ path: path.join(out, `${mode}.png`), fullPage: true });
    await context.close();
    record(
      `${mode}: morning copy does not claim an unconfirmed, blocked or outdated analysis ran today`,
    );
  }
  {
    const { page, context } = await open("mode=ready");
    await expect(page.getByText("Prediction records evaluated", { exact: false })).toContainText(
      "distinct days: 1",
    );
    await expect(
      page.getByText("Model weights and the training plan were not changed", { exact: false }),
    ).toBeVisible();
    await page.screenshot({ path: path.join(out, "confirmed.png"), fullPage: true });
    await context.close();
    record(
      "confirmed receipt separates two evaluated records from one independent day and explicitly states unchanged model/plan",
    );
  }
  {
    const { page, context } = await open("screen=brief");
    await expect(page.getByText("Synthetic brief A", { exact: true })).toBeVisible();
    await expect(page.getByText("LEAKED OLD ACCOUNT", { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.__nightAuth.switchOwner(window.__nightAuth.B));
    await expect(page.getByText("Synthetic brief B", { exact: true })).toBeVisible();
    await expect(page.getByText("Private interpretation A", { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.__nightAuth.switchOwner(window.__nightAuth.A));
    await expect(page.getByText("Synthetic brief A", { exact: true })).toBeVisible();
    await expect(page.getByText("Private interpretation B", { exact: true })).toHaveCount(0);
    await context.close();
    record("daily AI brief ignores legacy ownerless caches and changes cleanly across A → B → A");
  }
  {
    const { page, context } = await open("screen=brief&mode=delayed");
    await expect.poll(() => page.evaluate(() => window.__nightCalls.brief)).toBe(1);
    await page.evaluate(() => window.__nightAuth.switchOwner(window.__nightAuth.B));
    await expect(page.getByText("Synthetic brief B", { exact: true })).toBeVisible();
    await expect(page.getByText("Private interpretation A", { exact: true })).toHaveCount(0);
    await context.close();
    record("a delayed A interpretation never paints over B's brief after an identity change");
  }
  for (const lang of ["lt", "en"]) {
    const { page, context } = await open("mode=ready&lang=" + lang, 320);
    await expect(
      page.getByRole("heading", {
        name: lang === "lt" ? "Ryto patikros įrašas" : "Morning review receipt",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await page.screenshot({ path: path.join(out, `confirmed-${lang}-320.png`), fullPage: true });
    await context.close();
    record(`${lang} confirmed review fits 320px with readable evidence and limits`);
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real morning/AI-brief components and AuthProvider; synthetic service responses; no live AI or night job",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await server.close();
}
