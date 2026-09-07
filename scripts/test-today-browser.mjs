import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Today is the one screen two people are always editing at once, and its whole
 * job is to be honest when there is nothing to show. These checks run it
 * against sources that answer with nothing — this account's real state — and
 * against a source that fails, and assert the screen tells those apart.
 *
 * It renders the real Overview component. Only the server functions, the
 * Supabase client, auth and the router are stood in for, because none of them
 * exist outside a running app.
 */
const root = process.cwd();
const artifacts = path.join(root, "test-results/today");
await mkdir(artifacts, { recursive: true });
const results = [];
let server;
let browser;

const record = (name) => {
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};

const stubs = (name) => path.join(root, "tests/today-browser", name);

/**
 * Stands in for every server function in the app, by name.
 *
 * The names are read off `src/lib/*.functions.ts` rather than listed here, so
 * a component reaching for a function nobody thought about still gets one
 * instead of crashing the fixture with a missing export — which is a failure
 * of the harness, not of the screen it is meant to be checking.
 */
const SERVER_FUNCTION_STUB = "\0today-server-functions";
function serverFunctionStub() {
  const names = new Set();
  for (const file of readdirSync(path.join(root, "src/lib"))) {
    if (!file.endsWith(".functions.ts")) continue;
    const source = readFileSync(path.join(root, "src/lib", file), "utf8");
    for (const match of source.matchAll(/^export const (\w+)/gm)) names.add(match[1]);
  }
  return {
    name: "today-server-function-stub",
    enforce: "pre",
    resolveId: (source) => (/\.functions(\.tsx?)?$/.test(source) ? SERVER_FUNCTION_STUB : null),
    load(id) {
      if (id !== SERVER_FUNCTION_STUB) return null;
      const overrides = JSON.stringify(stubs("functions-stub.ts"));
      return (
        `import * as answers from ${overrides};\n` +
        [...names]
          .map(
            (name) =>
              `export const ${name} = ${JSON.stringify(name)} in answers` +
              ` ? answers[${JSON.stringify(name)}] : async () => null;`,
          )
          .join("\n")
      );
    },
  };
}

try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/today-browser"),
    // The real public directory, so the Twin loads the figure it ships rather
    // than falling back to the generated surface and making the evidence
    // screenshots show a body the athlete never sees.
    publicDir: path.join(root, "public"),
    plugins: [serverFunctionStub(), react(), tailwindcss()],
    resolve: {
      alias: [
        { find: "@/lib/auth", replacement: stubs("auth-stub.ts") },
        { find: "@/integrations/supabase/client", replacement: stubs("supabase-stub.ts") },
        { find: /^@tanstack\/react-router$/, replacement: stubs("router-stub.tsx") },
        { find: /^@tanstack\/react-start(\/.*)?$/, replacement: stubs("start-stub.ts") },
        { find: /^@tanstack\/start-server-core/, replacement: stubs("empty-stub.ts") },
        { find: /^@tanstack\/react-start-server/, replacement: stubs("empty-stub.ts") },
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
    server: { host: "127.0.0.1", port: 4183, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();

  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const openPanel = async (query = "") => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:4183/index.html${query}`);
    return { page, errors };
  };

  const open = async (query = "") => {
    const opened = await openPanel(query);
    await expect(opened.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30000 });
    return opened;
  };

  // 1. The screen renders at all, with the signal rail and every signal in it.
  const first = await open();
  const rail = first.page.getByRole("region", { name: "Live signals" });
  await expect(rail).toBeVisible();
  for (const label of [
    "Sleep",
    "HRV",
    "Resting HR",
    "Steps",
    "Active energy",
    "Weight",
    "Body fat",
  ]) {
    await expect(rail.getByText(label, { exact: true })).toBeVisible();
  }
  record("Today renders and the signal rail lists every signal");

  // 2. Nothing recorded must read as nothing recorded — not as a zero, and not
  //    as a blank the athlete would take for "fine".
  await expect(rail.getByText("Not recorded yet").first()).toBeVisible();
  expect(await rail.getByText("Not recorded yet").count()).toBe(7);
  const railText = (await rail.innerText()).replace(/[—–-]/g, "");
  expect(/\d/.test(railText)).toBe(false);
  await expect(first.page.getByRole("link", { name: "Connect a device" })).toBeVisible();
  record("an empty source shows as empty, with no invented figure and a way to fix it");

  // 3. Every Future Lab panel with no evidence says so rather than showing a
  //    number it does not have.
  const body = await first.page.locator("body").innerText();
  expect(body).toContain("Not enough verified data yet.");
  await writeFile(path.join(artifacts, "today.txt"), body);
  await first.page.screenshot({
    path: path.join(artifacts, "today-desktop.png"),
    fullPage: true,
  });
  record("panels without evidence say so instead of showing a figure");

  // 4. A failed read is a different sentence from an empty one.
  const failed = await open("?signals=fail");
  const failedRail = failed.page.getByRole("region", { name: "Live signals" });
  await expect(failedRail.getByText("Could not be read").first()).toBeVisible();
  expect(await failedRail.getByText("Could not be read").count()).toBe(7);
  await expect(failedRail.getByText("Not recorded yet")).toHaveCount(0);
  record("a source that could not be read never reads as a source with no data");

  // 5. The plan panel lists the real session, and shows no load — the
  //    programme does not carry one, and printing a weight here would be the
  //    screen writing a prescription nobody set.
  await expect(first.page.getByRole("region", { name: "Today's plan" })).toBeVisible();
  await expect(first.page.getByRole("link", { name: "Create a programme" })).toBeVisible();

  const planned = await open("?plan=ready");
  const plan = planned.page.getByRole("region", { name: "Today's plan" });
  await expect(plan.getByText("Upper body focus")).toBeVisible();
  await expect(plan.getByText("Bench press", { exact: true })).toBeVisible();
  await expect(plan.getByText("4 × 6", { exact: true })).toBeVisible();
  expect(await plan.innerText()).not.toMatch(/\bkg\b/);
  await expect(planned.page.getByRole("link", { name: "Start workout" })).toBeVisible();
  expect(planned.errors).toEqual([]);
  await planned.page.screenshot({
    path: path.join(artifacts, "today-with-plan.png"),
    fullPage: true,
  });
  record("today's session is listed from the programme, with no load it does not have");

  // 6. The ingest key is a bearer credential. It must not be sitting in the
  //    page for a shoulder, a screen share or a screenshot to pick up.
  const health = await openPanel("?panel=health");
  const KEY = "11111111-2222-4333-8444-555555555555";
  await expect(health.page.getByRole("region", { name: "Connect a watch or phone" })).toBeVisible();
  expect(await health.page.locator("body").innerText()).not.toContain(KEY);
  await health.page.getByRole("button", { name: "Show key" }).click();
  await expect(health.page.getByText(KEY, { exact: true })).toBeVisible();
  await health.page.getByRole("button", { name: "Hide key" }).click();
  expect(await health.page.locator("body").innerText()).not.toContain(KEY);
  // And it says whether anything has ever arrived, so a broken automation
  // cannot look like one that was never set up.
  await expect(health.page.getByText("Nothing has arrived yet")).toBeVisible();
  await health.page.screenshot({ path: path.join(artifacts, "health-source.png"), fullPage: true });
  expect(health.errors).toEqual([]);
  record("the ingest key stays masked until asked for, and delivery status is stated");

  // 7. Strict mode mounts every component twice. Nothing may throw.
  expect(first.errors).toEqual([]);
  expect(failed.errors).toEqual([]);
  record("strict-mode double mount raises no uncaught error");

  // 8. The narrowest phone still in use must not scroll sideways.
  await first.page.setViewportSize({ width: 320, height: 720 });
  await first.page.waitForTimeout(400);
  const overflow = await first.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await first.page.screenshot({ path: path.join(artifacts, "today-320.png"), fullPage: true });
  record("no horizontal overflow at 320px");

  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server?.close();
}
