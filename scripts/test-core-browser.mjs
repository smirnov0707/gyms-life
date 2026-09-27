import { verifyRiskDesign } from "./test-core-risk-design.mjs";
import { verifyObservedDesign } from "./test-core-observed-design.mjs";
import { verifyWeeklyDesign } from "./test-core-weekly-design.mjs";
import { verifyPerformanceDesign } from "./test-core-performance-design.mjs";
import { verifyLedgerDesign } from "./test-core-ledger-design.mjs";
import { verifyCameraDesign } from "./test-core-camera-design.mjs";
import { verifySupplementDesign } from "./test-core-supplement-design.mjs";
import { verifyIntakeDesign } from "./test-core-intake-design.mjs";
import { verifySessionDesign } from "./test-core-session-design.mjs";
import { verifyCoreDesign } from "./test-core-design.mjs";
import { verifyFoundationMerge } from "./test-foundation-browser.mjs";
import { verifyAiUi } from "./test-ai-ui-browser.mjs";
import { verifyPlanIntegrity } from "./test-plan-integrity-browser.mjs";
import { verifyCoreActions } from "./test-core-actions-browser.mjs";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = process.cwd(),
  fixture = (name) => path.join(root, "tests/core-browser", name);
const artifacts = path.join(
  root,
  process.env.CORE_BROWSER_ARTIFACTS ?? "test-results/core-browser",
);
await mkdir(artifacts, { recursive: true });
const results = [],
  errors = [];
const names = new Set();
for (const file of readdirSync(path.join(root, "src/lib"))) {
  if (!file.endsWith(".functions.ts")) continue;
  for (const match of readFileSync(path.join(root, "src/lib", file), "utf8").matchAll(
    /^export const (\w+)/gm,
  ))
    names.add(match[1]);
}
const virtual = "\0core-service-fixtures";
const server = await createServer({
  configFile: false,
  root: fixture(""),
  publicDir: path.join(root, "public"),
  plugins: [
    {
      name: "core-synthetic-services",
      enforce: "pre",
      resolveId: (source) => (/\.functions(?:\.tsx?)?$/.test(source) ? virtual : null),
      load: (id) =>
        id === virtual
          ? `import * as answers from ${JSON.stringify(fixture("functions-stub.ts"))};\n` +
            [...names]
              .map((name) =>
                name === "ProfileBodySchema"
                  ? `export { ProfileBodySchema } from ${JSON.stringify(fixture("profile-functions.ts"))};`
                  : `export const ${name}=(...args)=>{const fn=answers[${JSON.stringify(name)}];if(typeof fn!=="function")throw new Error("Action not implemented in read-only fixture: ${name}");return fn(...args);};`,
              )
              .join("\n")
          : null,
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@mediapipe/tasks-vision", replacement: fixture("pose-stub.ts") },
      { find: "@/lib/auth", replacement: fixture("auth-stub.tsx") },
      { find: "@/integrations/supabase/client", replacement: fixture("supabase-stub.ts") },
      { find: /^@tanstack\/react-router$/, replacement: fixture("router-stub.tsx") },
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
      "@tanstack/react-query",
      "zod",
      "lucide-react",
      "sonner",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.CORE_BROWSER_PORT ?? 4184),
    strictPort: true,
    fs: { allow: [root] },
  },
});
let browser;
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  if (process.argv.includes("--serve-only")) {
    console.log(`Core synthetic fixture: ${origin}`);
    await new Promise(() => {});
  }
  const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown core browser engine");
  const browserType = engine === "webkit" ? webkit : chromium;
  browser = await browserType.launch({
    ...(engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const open = async (query, viewport = { width: 1280, height: 900 }) => {
    const context = await browser.newContext({
      viewport,
      locale: "en-GB",
      timezoneId: "Europe/Vilnius",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-watermark")).toBeVisible({ timeout: 30000 });
    return { page, context };
  };
  // Exercise the newly changed boundary first; all existing checks still run.
  await verifyRiskDesign({ open, record, artifacts });
  await verifyObservedDesign({ open, record, artifacts });
  await verifyWeeklyDesign({ open, record, artifacts });
  await verifyPerformanceDesign({ open, record, artifacts });
  await verifyLedgerDesign({ open, record, artifacts });
  await verifyCameraDesign({ open, record, artifacts });
  await verifySupplementDesign({ open, record, artifacts });
  if (!process.argv.includes("--design-only")) {
    {
      const { page, context } = await open("screen=training");
      await expect(
        page.getByRole("heading", { name: "Synthetic training programme" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Open today's decision" })).toHaveAttribute(
        "href",
        /screen=today/,
      );
      await expect(page.getByRole("link", { name: "Build again" })).toHaveAttribute(
        "href",
        /screen=onboarding/,
      );
      await page.locator("summary").click();
      await expect(page.getByText("Synthetic session 1", { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(artifacts, "training-ready.png"), fullPage: true });
      await context.close();
      record(
        "training shows the saved plan, real retry/regeneration links and Today rather than the landing page",
      );
    }
    {
      const { page, context } = await open("screen=training&fail=training");
      await expect(
        page.getByText("Could not load your active program.", { exact: true }),
      ).toBeVisible();
      await page.evaluate(() => {
        window.__core.fail = null;
      });
      await page.getByRole("button", { name: "Try again in a moment." }).click();
      await expect(
        page.getByRole("heading", { name: "Synthetic training programme" }),
      ).toBeVisible();
      await context.close();
      record("failed training read is not an empty account; retry loads the same saved programme");
    }
    {
      const { page, context } = await open("screen=meals");
      await expect(
        page.getByRole("heading", { name: "Synthetic seven-day meal plan" }),
      ).toBeVisible();
      await expect(page.locator("select").first()).toHaveValue("vegan");
      expect(
        await page.locator("input").evaluateAll((inputs) => inputs.map((input) => input.value)),
      ).toContain("peanuts");
      expect(
        await page.locator("input").evaluateAll((inputs) => inputs.map((input) => input.value)),
      ).toContain("mushrooms");
      await expect(page.getByText(/Dynamic TDEE|Anabolic Refeed/)).toHaveCount(0);
      await page.screenshot({ path: path.join(artifacts, "meals-ready.png"), fullPage: true });
      await context.close();
      record(
        "saved diet/allergies/dislikes are restored and fabricated calorie/fasting panels are gone",
      );
    }
    {
      const { page, context } = await open("screen=meals&fail=meals");
      await expect(page.getByRole("alert")).toContainText("Could not load your saved meal plan");
      await expect(page.locator("fieldset")).toHaveAttribute("disabled", "");
      await expect(
        page.getByRole("button", { name: "Generate meal plan", exact: true }),
      ).toBeDisabled();
      await page.evaluate(() => {
        window.__core.fail = null;
      });
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Synthetic seven-day meal plan" }),
      ).toBeVisible();
      await context.close();
      record("meal load failure disables mutations and retry restores the saved plan");
    }
    {
      const { page, context } = await open("screen=nutrition&fail=food");
      await expect(page.getByRole("alert")).toContainText("Could not load today's food log");
      await page.locator("summary").filter({ hasText: "Inspect today's food log" }).click();
      await expect(page.getByText("Food log unavailable", { exact: true })).toBeVisible();
      await page.evaluate(() => {
        window.__core.fail = null;
      });
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByText("Synthetic breakfast", { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(artifacts, "nutrition-ready.png"), fullPage: true });
      await context.close();
      record("nutrition read error stays unknown rather than zero; retry restores local-day meals");
    }
    {
      const { page, context } = await open("screen=onboarding");
      await expect(
        page.getByRole("heading", { name: /What's your main goal|goal|tiksl/i }).first(),
      ).toBeVisible();
      await expect(page.locator("input[type=file]")).toHaveCount(0);
      await page.getByRole("button", { name: /^Next/ }).click();
      await expect(
        page.getByRole("button", { name: "Resistance bands", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Next/ }).click();
      await expect(page.locator("#w")).toHaveValue("68");
      await expect(page.locator("#h")).toHaveValue("170");
      await expect(page.locator("textarea")).toHaveValue("Existing synthetic restriction");
      await page.screenshot({
        path: path.join(artifacts, "onboarding-profile.png"),
        fullPage: true,
      });
      await context.close();
      record(
        "quick onboarding includes equipment, retains stored body/limitations, and does not auto-pick a goal from a photo",
      );
    }
    await verifyCoreActions({ open, record });
    await verifyPlanIntegrity({ open, record });
    await verifyAiUi({ open, record, artifacts });
    await verifyFoundationMerge({ open, record, artifacts });
    for (const screen of ["meals", "nutrition", "training", "onboarding", "workout"])
      for (const lang of ["lt", "en"])
        for (const width of [320, 390]) {
          const { page, context } = await open(`screen=${screen}&lang=${lang}`, {
            width,
            height: 844,
          });
          await expect(page.locator("h1,h2").first()).toBeVisible();
          await page.waitForTimeout(500);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          ).toBe(true);
          expect(errors).toEqual([]);
          await context.close();
          record(
            `${screen}: ${lang} ${width}px mobile content has no horizontal overflow or uncaught page error`,
          );
        }
  }
  await verifyCoreDesign({ open, record, artifacts });
  await verifySessionDesign({ open, record, artifacts });
  await verifyIntakeDesign({ open, record, artifacts });
  expect(errors).toEqual([]);
} catch (error) {
  // Controlled fixtures only: retain the observed failure instead of hiding it with a retry.
  for (const context of browser?.contexts() ?? []) {
    for (const page of context.pages()) {
      console.log(
        "CORE_FAILURE_STATE " +
          JSON.stringify(
            await page.evaluate(() => ({
              url: location.href,
              text: document.body.innerText,
              fixture: {
                counts: window.__core.counts,
                last: window.__core.last,
                fail: window.__core.fail,
                checkin: window.__core.checkin,
                supplements: window.__core.supplements,
              },
              camera: window.__supplementCamera,
              toasts: [...document.querySelectorAll("[data-sonner-toast]")].map(
                (el) => el.textContent,
              ),
            })),
          ),
      );
    }
  }
  throw error;
} finally {
  await writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real route components with controlled synthetic read/write responses. Real AI providers and production database transactions are not certified by this suite.",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  await browser?.close();
  await server.close();
}
