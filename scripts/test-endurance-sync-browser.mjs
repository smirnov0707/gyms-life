import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = process.cwd();
const fixture = (name) => path.join(root, "tests/endurance-browser", name);
const out = path.join(root, "test-results/endurance-sync");
const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
const results = [],
  errors = [];
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: fixture(""),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/lib/endurance-activity.functions", replacement: fixture("functions-stub.ts") },
      {
        find: "@/lib/endurance-session-match.functions",
        replacement: fixture("functions-stub.ts"),
      },
      {
        find: /^@tanstack\/react-start$/,
        replacement: path.join(root, "tests/today-browser/start-stub.ts"),
      },
      { find: "@", replacement: path.join(root, "src") },
    ],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "react/jsx-runtime", "zod", "lucide-react", "sonner"],
  },
  server: { host: "127.0.0.1", port: 4189, strictPort: true, fs: { allow: [root] } },
});
let browser;
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  await server.listen();
  browser = await (engine === "webkit" ? webkit : chromium).launch({
    ...(engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-gpu"],
        }
      : {}),
  });
  const origin = "http://127.0.0.1:4189";
  const open = async (query = "", width = 390) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: "en-GB",
      timezoneId: "Europe/Vilnius",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        errors.push("Unexpected external request: " + new URL(route.request().url()).origin);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-watermark")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return { page, context };
  };
  const fillRun = async (page, lt = false) => {
    await page
      .getByRole("textbox", { name: lt ? "Trukmė minutėmis" : "Duration in minutes", exact: true })
      .fill("30");
    await page
      .getByRole("textbox", {
        name: lt ? "Atstumas kilometrais" : "Distance in kilometres",
        exact: true,
      })
      .fill("5");
    await page
      .getByRole("textbox", {
        name: lt ? "Juntamos pastangos nuo 1 iki 10" : "Perceived effort from 1 to 10",
        exact: true,
      })
      .fill("4");
  };
  {
    const { page, context } = await open();
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Run saved.");
    await page.getByRole("button", { name: "Retry plan sync", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry plan sync", exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() => ({
        log: window.__endurance.logCalls,
        saved: window.__endurance.savedSessions,
        retryIds: window.__endurance.retryIds,
        trainingEvents: window.__endurance.trainingEvents,
        enduranceEvents: window.__endurance.enduranceEvents,
      })),
    ).toEqual({
      log: 1,
      saved: 1,
      retryIds: ["20000000-0000-4000-8000-000000000002"],
      trainingEvents: 1,
      enduranceEvents: 2,
    });
    await context.close();
    record("retry only synchronizes the saved run and never emits another training completion");
  }
  {
    const { page, context } = await open("failRetry=1");
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    const retry = page.getByRole("button", { name: "Retry plan sync", exact: true });
    await retry.click();
    await expect(
      page.getByText("Run is saved. Plan sync is still unavailable.", { exact: true }),
    ).toBeVisible();
    await expect(retry).toBeEnabled();
    await page.evaluate(() => {
      window.__endurance.failRetry = false;
    });
    await retry.click();
    await expect(retry).toHaveCount(0);
    expect(await page.evaluate(() => window.__endurance.retryIds)).toEqual(
      Array(2).fill("20000000-0000-4000-8000-000000000002"),
    );
    expect(await page.evaluate(() => window.__endurance.savedSessions)).toBe(1);
    await context.close();
    record("transport failure retains the same run ID for a later sync retry");
  }
  {
    const { page, context } = await open("failRefresh=1");
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(
      page.getByText("Run saved. The dashboard could not refresh; do not save it again.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Run could not be saved.", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__endurance.savedSessions)).toBe(1);
    await context.close();
    record("presentation callback failure does not claim the durable run save failed");
  }
  {
    const { page, context } = await open("confirmation=1");
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await page.getByRole("button", { name: "Retry plan sync", exact: true }).click();
    await expect(page.getByText("Was this your planned easy run?", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__endurance.confirmCalls)).toBe(0);
    await page.getByRole("button", { name: "Yes, count it", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__endurance.confirmCalls)).toBe(1);
    expect(await page.evaluate(() => window.__endurance.savedSessions)).toBe(1);
    await context.close();
    record("retry does not bypass separate athlete consent for an ambiguous match");
  }
  {
    const { page, context } = await open("phase=insights");
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Run saved and linked. Plan analysis could not refresh.",
    );
    await context.close();
    record("a committed match is distinguished from an uncompleted match");
  }
  {
    const { page, context } = await open("failSave=1");
    await fillRun(page);
    await page.getByRole("button", { name: "Credit this run", exact: true }).click();
    await expect(page.getByText("Run could not be saved.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry plan sync", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__endurance.savedSessions)).toBe(0);
    await context.close();
    record("a refused primary save remains an actual save failure");
  }
  {
    const { page, context } = await open();
    await fillRun(page);
    // Deliberately exercise two same-tick DOM activations before React rerenders.
    await page.getByRole("button", { name: "Credit this run", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByRole("status")).toContainText("Run saved.");
    expect(await page.evaluate(() => window.__endurance.logCalls)).toBe(1);
    await context.close();
    record("same-tick repeated activation submits only one save request");
  }
  for (const theme of ["dark", "light"]) {
    const { page, context } = await open(`lang=lt&theme=${theme}`, 320);
    await fillRun(page, true);
    await page.getByRole("button", { name: "Užskaityti bėgimą", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Bėgimas išsaugotas.");
    const retry = page.getByRole("button", { name: "Pakartoti plano susiejimą", exact: true });
    await expect(retry).toBeVisible();
    expect(await retry.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
      44,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: path.join(out, `retry-lt-320-${theme}.png`), fullPage: true });
    await context.close();
    record(`Lithuanian 320px ${theme} notice and retry control fit without sideways scrolling`);
  }
  expect(errors).toEqual([]);
  expect(results).toHaveLength(9);
} catch (error) {
  await writeFile(path.join(out, "failure.txt"), String(error?.stack ?? error));
  throw error;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        engine,
        synthetic: true,
        scope: "Real QuickRunLog UI with isolated service responses; not live account acceptance",
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
