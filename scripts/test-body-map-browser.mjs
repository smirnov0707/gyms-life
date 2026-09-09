import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const artifacts = path.join(root, "test-results/body-map");
await mkdir(artifacts, { recursive: true });
const results = [];
let server;
let browser;

function record(name) {
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
}

try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/body-map-browser"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@/lib/digital-twin.functions",
          replacement: path.join(root, "tests/body-map-browser/service-stub.ts"),
        },
        {
          find: "@/lib/i18n",
          replacement: path.join(root, "tests/body-map-browser/i18n-stub.ts"),
        },
        {
          find: "@tanstack/react-router",
          replacement: path.join(root, "tests/body-map-browser/router-stub.tsx"),
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
        "lucide-react",
      ],
    },
    server: { host: "127.0.0.1", port: 4182, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();

  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("http://127.0.0.1:4182");
  await expect(
    page.getByRole("heading", { name: "Inspect one body region", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByText("38%", { exact: true }).last()).toBeVisible();
  record("lowest known recovery region becomes the initial inspection target");

  const chestRow = page.getByRole("button").filter({ hasText: "Chest" }).first();
  await chestRow.click();
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  await expect(page.getByText("72%", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("3,000 kg", { exact: true })).toBeVisible();
  record(
    "region selection exposes recovery, recorded load and provenance without changing Twin core",
  );

  const glutesRow = page.getByRole("button").filter({ hasText: "Glutes" }).first();
  await glutesRow.click();
  await expect(page.getByRole("heading", { name: "Glutes", exact: true })).toBeVisible();
  await expect(page.getByText("No compatible evidence", { exact: true })).toBeVisible();
  record("unknown regions stay unknown");

  const backViewToggle = page.locator("button").filter({ hasText: /^Back$/ });
  await backViewToggle.click();
  await expect(backViewToggle).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: path.join(artifacts, "desktop.png"), fullPage: true });
  expect(errors).toEqual([]);
  record("desktop Body Map renders without uncaught browser errors");
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("http://127.0.0.1:4182");
  await expect(
    mobilePage.getByRole("heading", { name: "Inspect one body region", exact: true }),
  ).toBeVisible();
  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const bodyMapLink = mobilePage.getByRole("link", { name: "Open full My Twin", exact: true });
  await bodyMapLink.scrollIntoViewIfNeeded();
  const box = await bodyMapLink.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await mobilePage.screenshot({ path: path.join(artifacts, "mobile.png"), fullPage: true });
  record("mobile Body Map has no horizontal overflow and preserves a touch-size primary action");
  await mobile.close();

  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}
