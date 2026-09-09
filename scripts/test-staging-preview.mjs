import { chromium, webkit, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const STAGE = "yywnpovsqifwujuxdxog",
  PRODUCTION = "tqwqbjkjqzusohxdzupr";
const base = process.env.STAGING_ORIGIN,
  key = process.env.STAGING_PUBLISHABLE_KEY;
if (!base || !key) throw new Error("STAGING_PUBLIC_CONFIGURATION_REQUIRED");
const origin = new URL(base);
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/" ||
  !origin.hostname.endsWith("--singular-vacherin-57448d.netlify.app")
)
  throw new Error("NOT_AN_AUTHORIZED_PREVIEW_ORIGIN");
if (!key.startsWith("sb_publishable_")) throw new Error("EXPECTED_STAGING_PUBLIC_KEY");
const directory = path.join(process.cwd(), "test-results/staging-preview");
await mkdir(directory, { recursive: true });
const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("UNSUPPORTED_BROWSER");
const browser = await (engine === "webkit" ? webkit : chromium).launch(
  engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
const errors = [],
  productionAttempts = [],
  sources = [];
let outcome;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Europe/Vilnius",
  });
  await context.addInitScript(() => localStorage.setItem("forma_lang", "en"));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === `${PRODUCTION}.supabase.co` || url.hostname === "gyms.life") {
      productionAttempts.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 500)));
  const reads = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin !== origin.origin ||
      !new URL(response.url()).pathname.endsWith(".js")
    )
      return;
    reads.push(
      response
        .text()
        .then((text) =>
          sources.push({
            path: new URL(response.url()).pathname,
            stage: text.includes(STAGE),
            production: text.includes(PRODUCTION),
          }),
        )
        .catch(() => {}),
    );
  });
  const response = await page.goto(new URL("/auth", origin).href, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await Promise.all(reads);
  expect(productionAttempts).toEqual([]);
  expect(sources.some((source) => source.stage)).toBe(true);
  expect(sources.some((source) => source.production)).toBe(false);
  expect(errors).toEqual([]);
  const catalogue = await fetch(
    `https://${STAGE}.supabase.co/rest/v1/exercises?select=id,slug&limit=1`,
    { headers: { apikey: key }, signal: AbortSignal.timeout(15000) },
  );
  expect(catalogue.status).toBe(200);
  const rows = await catalogue.json();
  expect(Array.isArray(rows) && rows.length === 1).toBe(true);
  await page.screenshot({
    path: path.join(directory, `preview-auth-${engine}.png`),
    fullPage: true,
  });
  outcome = {
    status: "passed",
    scope:
      "Real deployed unauthenticated login page, compiled DB target and public staging catalogue only; no account created or private data read",
    origin: origin.origin,
    engine,
    loginHttpStatus: response.status(),
    stageTargetObserved: true,
    productionTargetObserved: false,
    publicCatalogueReadable: true,
    errors,
    productionAttempts,
    sources,
  };
  await context.close();
  console.log(
    "PASS real preview login/public target; authenticated workflow remains a separate gate",
  );
} catch (error) {
  outcome = {
    status: "failed",
    scope: "Unauthenticated preview preflight only",
    origin: origin.origin,
    engine,
    reason: error instanceof Error ? error.message.slice(0, 600) : "preflight failed",
    errors,
    productionAttempts,
    sources,
  };
  throw error;
} finally {
  await writeFile(
    path.join(directory, `results-${engine}.json`),
    JSON.stringify(outcome, null, 2) + "\n",
  );
  await browser.close();
}
