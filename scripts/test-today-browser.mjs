import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Today is the one screen two people are always editing at once, and its whole
 * job is to be honest when there is nothing to show. These checks run it
 * against explicit synthetic empty-source fixtures and
 * against a source that fails, and assert the screen tells those apart.
 *
 * It renders the real Overview component. Only the server functions, the
 * Supabase client, auth and the router are stood in for, because none of them
 * exist outside a running app.
 */
const root = process.cwd();
// A local --serve-only preview must not prevent an independent test run.
// Keep a strict port so the browser can never hit somebody else's fixture.
const port = Number(process.env.TODAY_BROWSER_PORT ?? "4183");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("TODAY_BROWSER_PORT must be an integer between 1024 and 65535");
const origin = `http://127.0.0.1:${port}`;
const candidateMode = process.env.TWIN_ANATOMY_CANDIDATE ?? "";
if (!["", "1", "clean", "pose", "muscular", "sculpt"].includes(candidateMode))
  throw new Error(`Unknown anatomy candidate: ${candidateMode}`);
const candidate = candidateMode !== "";
const candidatePath =
  candidateMode === "sculpt"
    ? "tests/twin-browser/assets/twin-anatomy-sculpt-candidate.glb"
    : candidateMode === "muscular"
      ? "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb"
      : candidateMode === "pose"
        ? "tests/twin-browser/assets/twin-anatomy-pose-candidate.glb"
        : "tests/twin-browser/assets/twin-anatomy-continuous-candidate.glb";
// Read before starting Vite or Chromium. A missing candidate must fail instead
// of silently rendering the production asset and passing the visual gate.
const candidateBytes = candidate ? await readFile(path.join(root, candidatePath)) : null;
if (
  candidateBytes &&
  (candidateBytes.length < 12 ||
    candidateBytes.toString("ascii", 0, 4) !== "glTF" ||
    candidateBytes.readUInt32LE(4) !== 2 ||
    candidateBytes.readUInt32LE(8) !== candidateBytes.length)
)
  throw new Error(`Invalid candidate GLB: ${candidatePath}`);
let candidateRequests = 0;
const candidatePlugin = {
  name: "test-only-anatomy-candidate",
  configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (
        !candidateBytes ||
        !["GET", "HEAD"].includes(request.method) ||
        new URL(request.url, "http://localhost").pathname !== "/models/twin-anatomy-v1.glb"
      )
        return next();
      response.setHeader("Content-Type", "model/gltf-binary");
      response.setHeader("Content-Length", candidateBytes.length);
      response.setHeader("Cache-Control", "no-store");
      if (request.method === "GET") candidateRequests++;
      response.end(request.method === "HEAD" ? undefined : candidateBytes);
    });
  },
};
const artifacts = path.join(
  root,
  candidate ? "test-results/today-candidate" : "test-results/today",
);
// A failed pose run must not leave clean-model screenshots beside pose metadata.
if (candidate) await rm(artifacts, { recursive: true, force: true });
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
const BRIEF_SCHEMA_STUB = "\0fixture-brief-schema";
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
    resolveId: (source) =>
      source === "virtual:fixture-brief-schema"
        ? BRIEF_SCHEMA_STUB
        : /\.functions(\.tsx?)?$/.test(source)
          ? SERVER_FUNCTION_STUB
          : null,
    async load(id) {
      if (id === BRIEF_SCHEMA_STUB) {
        // The brief schema currently lives beside a server function. Reuse its
        // exact declaration block without importing any auth/provider runtime.
        const source = readFileSync(path.join(root, "src/lib/brief.functions.ts"), "utf8");
        const begin = source.indexOf("export const BRIEF_ROUTES");
        const end = source.indexOf("\nfunction isBriefRoute(");
        if (begin < 0 || end <= begin)
          throw new Error("Brief schema boundary changed; update the fixture adapter.");
        return (
          await transformWithEsbuild(
            `import { z } from "zod";\n${source.slice(begin, end)}`,
            "fixture-brief-schema.ts",
            { loader: "ts" },
          )
        ).code;
      }
      if (id !== SERVER_FUNCTION_STUB) return null;
      const overrides = JSON.stringify(stubs("functions-stub.ts"));
      const reference = JSON.stringify(stubs("reference-functions.ts"));
      return (
        `import * as answers from ${overrides};\nimport * as reference from ${reference};\nimport * as briefSchemas from "virtual:fixture-brief-schema";\n` +
        [...names]
          .map((name) =>
            ["DailyBriefSchema", "BRIEF_ROUTES"].includes(name)
              ? `export const ${name} = briefSchemas.${name};`
              : `export const ${name} = typeof answers[${JSON.stringify(name)}] !== "function" && ${JSON.stringify(name)} in answers` +
                ` ? answers[${JSON.stringify(name)}] : (...args) => {` +
                ` const fn = new URLSearchParams(window.location.search).has("scenario") && ${JSON.stringify(name)} in reference ? reference[${JSON.stringify(name)}] : answers[${JSON.stringify(name)}];` +
                ` return typeof fn === "function" ? fn(...args) : Promise.resolve(null); };`,
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
    plugins: [
      ...(candidate ? [candidatePlugin] : []),
      serverFunctionStub(),
      react(),
      tailwindcss(),
    ],
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
        // These route trees include Recharts. Prebundle its CommonJS graph even
        // when node_modules is shared through a worktree symlink.
        "recharts",
        "lodash",
      ],
    },
    server: { host: "127.0.0.1", port, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();

  if (process.argv.includes("--serve-only")) {
    console.log(
      `Reference UI fixture ready: ${origin}/index.html?shell=1&screen=today&scenario=reference`,
    );
    console.log("Local serving only; no Playwright browser is launched.");
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    await server.close();
    process.exit(0);
  }

  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const openPanel = async (query = "", options = {}) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      colorScheme: "dark",
      ...options,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${origin}/index.html${query}`);
    return { page, errors };
  };

  const open = async (query = "", options = {}) => {
    const opened = await openPanel(query, options);
    await expect(opened.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30000 });
    return opened;
  };

  const openEvidence = async (panel, label) => {
    // Sources resolve asynchronously; wait for the actual disclosure instead
    // of taking a one-time inventory before the data arrives.
    const summary = panel.locator("details > summary").filter({ hasText: label });
    await expect(summary).toBeVisible({ timeout: 30000 });
    const details = summary.locator("..");
    if ((await details.getAttribute("open")) === null) await summary.click();
  };

  const assertInteractiveTwin = async (canvas) => {
    await expect(canvas).toBeVisible({ timeout: 30000 });
    // Playwright's visible state includes below-fold elements. The renderer
    // deliberately stops offscreen and when ambient motion is disabled; one
    // frame is valid. Bring it into view, then prove a real input is repainted.
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
    if (candidate) expect(candidateRequests).toBeGreaterThan(0);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-twin-frames")))
      .toBeGreaterThanOrEqual(1);
    const beforeFrames = Number(await canvas.getAttribute("data-twin-frames"));
    const beforeYaw = Number(await canvas.getAttribute("data-twin-yaw"));
    await canvas.press("ArrowRight");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-twin-frames")))
      .toBeGreaterThan(beforeFrames);
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute("data-twin-yaw")) - beforeYaw))
      .toBeGreaterThan(0.05);
    await canvas.press("ArrowLeft");
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute("data-twin-yaw")) - beforeYaw))
      .toBeLessThan(0.01);
    await canvas.evaluate((element) => element.blur());
  };

  // Capture the real route trees inside the real shell before legacy checks,
  // so downloadable design evidence survives a later regression failure.
  const references = [];
  for (const viewport of [
    { name: "reference", width: 1280, height: 853 },
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    for (const screen of ["today", "twin", "muscle", "futureme", "lab", "journal"]) {
      if (viewport.name === "reference" && screen !== "today") continue;
      const shown = await openPanel(`?shell=1&screen=${screen}&scenario=reference`, {
        viewport: { width: viewport.width, height: viewport.height },
        locale: "en-US",
      });
      await expect(shown.page.getByTestId("fixture-watermark")).toBeVisible({ timeout: 30000 });
      await expect(shown.page.locator(".fl-shell-header")).toBeVisible();
      await expect(
        shown.page.locator(
          viewport.name === "mobile" ? ".fl-mobile-navigation" : ".fl-desktop-navigation",
        ),
      ).toBeVisible();
      const canvas = shown.page.locator("canvas[data-twin-frames]").first();
      if (["today", "twin", "muscle"].includes(screen)) {
        await assertInteractiveTwin(canvas);
      }
      if (screen === "muscle") {
        // Exercise the real UI. There is deliberately no invented detail route.
        await shown.page.getByRole("tab", { name: "Muscles", exact: true }).click();
        await shown.page
          .getByRole("button", { name: /^Chest(?:\s|$)/ })
          .first()
          .click();
        const detail = shown.page.locator('[data-twin-muscle-detail="chest"]');
        await expect(detail).toBeVisible();
        await assertInteractiveTwin(detail.locator("canvas[data-twin-frames]"));
      }
      if (viewport.name === "mobile" && ["twin", "muscle"].includes(screen)) {
        const stage = shown.page.locator("[data-twin-stage]");
        await expect(stage).toHaveAttribute("data-twin-mobile-compact", "true");
        await expect(stage.locator("[data-twin-mobile-unit]")).toContainText("CALCULATED", {
          ignoreCase: true,
        });
        const controls = stage.getByRole("button", { name: "View controls", exact: true });
        await expect(controls).toHaveAttribute("aria-expanded", "false");
        await expect(stage.getByRole("button", { name: "2D", exact: true })).toBeHidden();
        await controls.focus();
        await shown.page.keyboard.press("Enter");
        await expect(controls).toHaveAttribute("aria-expanded", "true");
        if (screen === "twin") {
          await stage.getByRole("button", { name: "Logged volume", exact: true }).click();
          await expect(stage).toHaveAttribute("data-twin-layer", "logged_volume");
          await stage.getByRole("button", { name: "Recovery", exact: true }).click();
          await expect(stage).toHaveAttribute("data-twin-layer", "recovery");
        }
        await stage.getByRole("button", { name: "2D", exact: true }).click();
        await expect(stage).toHaveAttribute("data-twin-stage", "2d");
        await expect(stage.locator("canvas")).toHaveCount(0);
        await stage.getByRole("button", { name: "3D", exact: true }).click();
        await assertInteractiveTwin(stage.locator("canvas[data-twin-frames]"));
        await stage.getByRole("button", { name: "Front", exact: true }).focus();
        await shown.page.keyboard.press("Escape");
        await expect(controls).toHaveAttribute("aria-expanded", "false");
        await expect(controls).toBeFocused();
        const region = stage.getByRole("combobox", { name: "Inspect a region", exact: true });
        await region.focus();
        await expect(region).toBeFocused();
        await expect(region).toBeEnabled();
        record(`${screen} mobile controls retain keyboard access, layers and 3D/2D rendering`);
      }
      for (const illustration of await shown.page.locator(".fl-illustrative-athlete img").all()) {
        await illustration.scrollIntoViewIfNeeded();
        await expect
          .poll(async () =>
            illustration.evaluate((image) => image.complete && image.naturalWidth > 0),
          )
          .toBe(true);
      }
      await shown.page.evaluate(() => window.scrollTo(0, 0));
      await shown.page.waitForTimeout(700);
      const overflow = await shown.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen} ${viewport.name} overflows`).toBeLessThanOrEqual(1);
      expect(shown.errors, `${screen} ${viewport.name} raised an error`).toEqual([]);
      const filename = `reference-${screen}-${viewport.name}.png`;
      await shown.page.screenshot({ path: path.join(artifacts, filename), fullPage: true });
      if (viewport.name === "reference") {
        await shown.page.screenshot({
          path: path.join(artifacts, "reference-today-1280x853.png"),
          fullPage: false,
        });
        const layout = await shown.page.evaluate(() =>
          [".fl-cockpit", ".fl-bottom-deck", ".fl-dashboard-footer"].map((selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return { selector, ...(rect?.toJSON() ?? {}) };
          }),
        );
        await writeFile(
          path.join(artifacts, "reference-layout.json"),
          JSON.stringify(layout, null, 2),
        );
      }
      await writeFile(
        path.join(artifacts, `reference-${screen}-${viewport.name}.txt`),
        await shown.page.locator("body").innerText(),
      );
      references.push({
        screen,
        viewport,
        filename,
        scenario: "synthetic-reference",
        url: shown.page.url(),
      });
      await shown.page.context().close();
    }
  }
  await writeFile(
    path.join(artifacts, "reference-screens.json"),
    JSON.stringify(references, null, 2),
  );
  record("all six actual route/detail views render inside the shell at 1440px and 390px");

  for (const scenario of ["empty", "failure"]) {
    const checked = await openPanel(`?shell=1&screen=today&scenario=${scenario}`, {
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
    const rail = checked.page.getByRole("region", { name: "Live signals" });
    await expect(rail).toBeVisible({ timeout: 30000 });
    const label = scenario === "failure" ? "Could not be read" : "Not recorded yet";
    expect(await rail.getByText(label, { exact: false }).count()).toBe(7);
    expect(checked.errors).toEqual([]);
    await checked.page.screenshot({
      path: path.join(artifacts, `reference-today-${scenario}-mobile.png`),
      fullPage: true,
    });
    await checked.page.context().close();
  }
  record("full-shell empty data and source failures remain visibly distinct");

  const menu = await openPanel("?shell=1&screen=twin&scenario=reference&view=muscles", {
    viewport: { width: 320, height: 720 },
    locale: "en-US",
  });
  await menu.page.getByRole("button", { name: "More", exact: true }).click();
  const drawer = menu.page.getByRole("dialog");
  await drawer.getByRole("button", { name: "LT", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "LT", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await menu.page.screenshot({
    path: path.join(artifacts, "mobile-menu-language.png"),
    fullPage: false,
  });
  await drawer.press("Escape");
  await expect(menu.page.getByRole("tab", { name: "Raumenys", exact: true })).toBeVisible();
  await menu.page.getByRole("button", { name: "Daugiau", exact: true }).click();
  await menu.page.getByRole("dialog").getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    menu.page.getByRole("dialog").getByRole("button", { name: "EN", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(menu.errors).toEqual([]);
  await menu.page.context().close();
  record(
    "the scrolled mobile tools menu keeps language controls clickable and updates the actual page",
  );

  // Real UI controls, not direct calls to state setters. Search values survive
  // page reload and browser history; the fixture still has no live backend.
  const linked = await openPanel("?shell=1&screen=today&scenario=reference", {
    viewport: { width: 390, height: 844 },
    locale: "en-US",
  });
  await linked.page.getByRole("link", { name: "Explore muscles", exact: false }).click();
  await expect(linked.page.getByRole("tab", { name: "Muscles", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await linked.page
    .getByRole("button", { name: /^Chest(?:\s|$)/ })
    .first()
    .click();
  await expect(linked.page.locator('[data-twin-muscle-detail="chest"]')).toBeVisible();
  await linked.page.getByRole("button", { name: "Impact", exact: true }).click();
  await expect(linked.page).toHaveURL(/detail=impact/);
  await expect(linked.page.getByText("Latest completed session", { exact: true })).toBeVisible();
  await linked.page.reload();
  await expect(linked.page.getByRole("button", { name: "Impact", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await linked.page.goBack();
  await expect(linked.page.getByRole("button", { name: "Status", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await linked.page.getByRole("button", { name: "History", exact: true }).click();
  await expect(linked.page).toHaveURL(/detail=history/);
  expect(linked.errors).toEqual([]);
  await linked.page.context().close();
  record(
    "Today opens muscle evidence; status, impact and history survive URL navigation and reload",
  );

  const offBody = await openPanel(
    "?shell=1&screen=twin&scenario=reference&view=muscles&region=cardio&detail=status",
    { locale: "en-US" },
  );
  const offBodyDetail = offBody.page.locator('[data-twin-muscle-detail="cardio"]');
  await expect(offBodyDetail).toBeVisible({ timeout: 30000 });
  await expect(
    offBodyDetail.getByText("This training group is not a single anatomical region.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(offBodyDetail.locator(".twin-detail-stage")).toHaveCount(0);
  expect(offBody.errors).toEqual([]);
  await offBody.page.context().close();
  record(
    "off-body training groups keep their evidence route without pretending to be a muscle surface",
  );

  for (const [scenario, expected] of [
    ["reference", "Received records refreshed."],
    ["empty", "Records checked. No readings have arrived yet."],
    ["failure", "Records could not be refreshed. No successful sync is claimed."],
  ]) {
    const checked = await openPanel(`?shell=1&screen=today&scenario=${scenario}`, {
      locale: "en-US",
      viewport: { width: 390, height: 844 },
    });
    const button = checked.page.getByTestId("refresh-received-data");
    await expect(button).toBeEnabled({ timeout: 30000 });
    await button.click();
    await expect(checked.page.getByTestId("received-data-refresh-status")).toHaveText(expected);
    await expect(button).toBeEnabled();
    expect(checked.errors).toEqual([]);
    await checked.page.context().close();
  }
  record(
    "manual data refresh distinguishes received, empty and failed records without claiming watch sync",
  );

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
  await expect(rail.getByRole("link", { name: "Connect a device" })).toBeVisible();
  record("an empty source shows as empty, with no invented figure and a way to fix it");

  // 3. No recovery evidence means no projection curve; prediction evidence
  //    shows a count of evaluated predictions, never a confidence percentage.
  const emptyOutlook = first.page.getByRole("region", { name: "When it comes back" });
  await expect(emptyOutlook.getByText("Not enough data to estimate recovery.")).toBeVisible();
  await expect(emptyOutlook.getByRole("img")).toHaveCount(0);
  const emptyEvidence = first.page.getByRole("region", { name: "Prediction evidence" });
  await expect(emptyEvidence.getByText("Evaluated predictions", { exact: true })).toBeVisible();
  expect(await emptyEvidence.locator(".fl-evidence-count strong").innerText()).toBe("0");
  expect(await emptyEvidence.innerText()).not.toMatch(/\d\s*%/);
  await expect(
    first.page.getByText("No pattern has reached its evidence threshold yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    first.page.getByText("No hypothesis is awaiting more evidence.", { exact: true }),
  ).toBeVisible();
  const body = await first.page.locator("body").innerText();
  expect(body).not.toContain("Not enough verified data yet."); // obsolete copy must not mask a stuck loading state

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
  // The screen has to name every field the endpoint accepts. It used to carry
  // a hand-written example, the endpoint grew fields it never mentioned, and
  // nobody could notice: a field never sent and a field rejected are the same
  // empty panel from the athlete's side.
  const healthText = await health.page.locator("body").innerText();
  for (const field of [
    "sleep_hours",
    "sleep_deep_minutes",
    "sleep_rem_minutes",
    "sleep_core_minutes",
    "sleep_awake_minutes",
    "hrv_ms",
    "resting_hr",
    "steps",
    "active_kcal",
    "vo2max",
  ]) {
    expect(healthText, `${field} is not documented on the setup screen`).toContain(field);
  }
  await health.page.screenshot({ path: path.join(artifacts, "health-source.png"), fullPage: true });
  expect(health.errors).toEqual([]);
  record("the ingest key stays masked until asked for, and delivery status is stated");

  // 7. The three Future Lab screens landed with no rendering check at all.
  //    They must come up against empty sources and say what they do not know,
  //    rather than crashing or filling the gap with a number.
  for (const [panel, name] of [
    ["lab", "Lab"],
    ["futureme", "Future Me"],
    ["journal", "Journal"],
  ]) {
    const screen = await openPanel(`?panel=${panel}`);
    await expect(screen.page.locator("section").first()).toBeVisible({ timeout: 30000 });
    const text = await screen.page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(40);
    expect(screen.errors, `${name} raised ${screen.errors[0]}`).toEqual([]);
    await screen.page.screenshot({
      path: path.join(artifacts, `screen-${panel}.png`),
      fullPage: true,
    });
    await screen.page.close();
  }
  record("Lab, Future Me and Journal render against sources with nothing in them");

  // A lab whose overview could not be read must not light ten modules green.
  // Absence of evidence is not evidence of readiness, which is the one claim
  // this deck makes about itself.
  const lab = await openPanel("?panel=lab&scenario=failure");
  await expect(lab.page.getByRole("heading", { name: "Lab", exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(lab.page.getByText("Source available", { exact: true })).toHaveCount(0);
  await expect(lab.page.getByText("Rules defined", { exact: true })).toHaveCount(0);
  await expect(lab.page.getByText("Unknown", { exact: true })).toHaveCount(10);
  await lab.page.screenshot({ path: path.join(artifacts, "screen-lab.png"), fullPage: true });
  await lab.page.close();
  record("an unread lab shows unknown modules instead of ready ones");

  // The journal's four counters all come off one query. An unread ledger must
  // not report four zeros — "you have no hypotheses" is a claim, and an empty
  // ledger is something an athlete might act on.
  const journal = await openPanel("?panel=journal&scenario=failure");
  await expect(journal.page.locator("section").first()).toBeVisible({ timeout: 30000 });
  await expect(
    journal.page.getByText("Journal intelligence is temporarily unavailable."),
  ).toBeVisible();
  await expect(journal.page.locator(".fl-journal-stats")).toHaveCount(0);
  await journal.page.screenshot({
    path: path.join(artifacts, "screen-journal.png"),
    fullPage: true,
  });
  await journal.page.close();
  const emptyJournal = await openPanel("?panel=journal&scenario=empty");
  const emptyCounters = emptyJournal.page.locator(".fl-journal-stats p.font-mono");
  await expect(emptyCounters).toHaveCount(4);
  expect(await emptyCounters.allInnerTexts()).toEqual(["0", "0", "0", "0"]);
  await emptyJournal.page.close();
  record("an unread journal reports an outage; only a readable empty ledger shows zero counters");

  // 8. Strict mode mounts every component twice. Nothing may throw.
  expect(first.errors).toEqual([]);
  expect(failed.errors).toEqual([]);
  record("strict-mode double mount raises no uncaught error");

  // 9. The narrowest phone still in use must not scroll sideways.
  await first.page.setViewportSize({ width: 320, height: 720 });
  await first.page.waitForTimeout(400);
  const overflow = await first.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await first.page.screenshot({ path: path.join(artifacts, "today-320.png"), fullPage: true });
  record("no horizontal overflow at 320px");

  // 10. And in the language the athlete actually reads it in. Lithuanian runs
  //     longer than English almost everywhere, so a layout that survives 320px
  //     in English can still break here — and this is the app's default
  //     language, not an afterthought.
  const lt = await open("", { locale: "lt-LT", viewport: { width: 320, height: 720 } });
  const ltRail = lt.page.getByRole("region", { name: "Gyvi signalai" });
  await expect(ltRail).toBeVisible({ timeout: 30000 });
  for (const label of ["Miegas", "Ramybės pulsas", "Aktyvi energija", "Kūno riebalai"]) {
    await expect(ltRail.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(lt.page.getByRole("region", { name: "Šiandienos planas" })).toBeVisible();
  // Every sentence on the screen has to be in the athlete's language. The Lab
  // card shipped its paragraph and its button in English only, so a Lithuanian
  // Today carried one English paragraph in the middle of it.
  const ltBody = await lt.page.locator("body").innerText();
  expect(ltBody).not.toContain("separates measurements");
  expect(ltBody).not.toContain("OPEN LAB");
  expect(ltBody).toContain("atskiria matavimus");
  const ltOverflow = await lt.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(ltOverflow).toBeLessThanOrEqual(1);

  // The two ways out of an empty rail are the only things to tap on it, so
  // they have to be reachable with a thumb.
  for (const name of ["Prijungti įrenginį", "Įvesti matavimą"]) {
    const box = await ltRail.getByRole("link", { name }).boundingBox();
    expect(box, `${name} is not on screen`).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await lt.page.screenshot({ path: path.join(artifacts, "today-lt-320.png"), fullPage: true });
  expect(lt.errors).toEqual([]);
  record("Lithuanian at 320px stays inside the screen with tappable controls");

  // 11. The template closes on a row of data sources reporting all systems
  //     operational. Ours reports what has actually arrived, which with
  //     nothing connected is two sources that have sent nothing and no
  //     readings at all — never a green light nobody earned.
  const sources = first.page.getByRole("region", { name: "Data sources" });
  await expect(sources).toBeVisible();
  expect(await sources.getByText("Nothing received").count()).toBe(2);
  await expect(sources.getByText("No readings at all")).toBeVisible();
  const sourcesText = await sources.innerText();
  expect(sourcesText).not.toMatch(/operational|all systems/i);

  const failedSources = failed.page.getByRole("region", { name: "Data sources" });
  expect(await failedSources.getByText("Could not check").count()).toBe(2);
  await expect(failedSources.getByText("Nothing received")).toHaveCount(0);
  // The tail used to read "No readings at all" beside two chips saying the
  // sources could not be checked — the strip contradicting itself, with the
  // wrong half sounding like a fact about the athlete.
  await expect(failedSources.getByText("No readings at all")).toHaveCount(0);
  await expect(failedSources.getByText("Last reading unknown")).toBeVisible();
  record("the sources row reports what arrived, and tells silence from an outage");

  // 12. Body composition: two measured numbers, two derived from them. The
  //     card must never let a lean-mass figure pass for something that was
  //     weighed, and must not turn one measurement into a trend.
  const one = await openPanel("?panel=body");
  const card = one.page.getByRole("region", { name: "Body composition" });
  await expect(card).toBeVisible({ timeout: 30000 });
  const oneText = await card.innerText();
  expect(oneText).toContain("68.0");
  expect(oneText).toContain("A second one is what turns it into a direction");
  expect(oneText).toMatch(/calculated from the weight and the body fat percentage/);
  // One reading carries no signed change anywhere on the card.
  expect(oneText).not.toMatch(/[+−-]\d+\.\d\s*kg/);
  await one.page.screenshot({ path: path.join(artifacts, "body-single.png"), fullPage: true });
  await one.page.close();

  const trend = await openPanel("?panel=body&body=change");
  const trendCard = trend.page.getByRole("region", { name: "Body composition" });
  await expect(trendCard).toBeVisible({ timeout: 30000 });
  const trendText = await trendCard.innerText();
  expect(trendText).toMatch(/[−-]1\.5/);
  expect(trendText).toContain("+0.5");
  expect(trendText).toContain("2026-08-13");
  expect(trendText).toMatch(/calculated from the weight and the body fat percentage/);
  await trend.page.screenshot({ path: path.join(artifacts, "body-change.png"), fullPage: true });
  expect(trend.errors).toEqual([]);
  await trend.page.close();

  // The photo scan writes weight and body fat into the same two columns a
  // scale does. This card used to state flatly that both were measured, which
  // for a scanned reading was false — and people change their training over
  // these numbers.
  const scanned = await openPanel("?panel=body&source=scan");
  const scannedCard = scanned.page.getByRole("region", { name: "Body composition" });
  await expect(scannedCard).toBeVisible({ timeout: 30000 });
  const scannedText = await scannedCard.innerText();
  expect(scannedText).toMatch(/come from the photo scan, not from a scale/);
  expect(scannedText).toContain("includes a model's visual estimate");
  expect(scannedText).not.toMatch(/You entered the weight/);
  await scanned.page.close();

  const weighed = await openPanel("?panel=body&source=scale");
  const weighedCard = weighed.page.getByRole("region", { name: "Body composition" });
  await expect(weighedCard).toBeVisible({ timeout: 30000 });
  const weighedText = await weighedCard.innerText();
  expect(weighedText).toMatch(/You entered the weight and the body fat percentage yourself/);
  expect(weighedText).not.toContain("photo scan");
  await weighed.page.close();

  // The default fixture row has no provenance at all, the state every row
  // written before these columns existed is in: not measured, not estimated,
  // not recorded.
  expect(oneText).toMatch(/It was not recorded whether these figures were measured/);
  record(
    "body composition shows a change only when there are two readings, and names what is derived",
  );

  // 13. The Twin screen's three views. Each one answers from a different
  //     source — the figure and the body from logged sets, the regions from
  //     the same sets in full, the systems from what a device measured — so
  //     switching tabs must never carry one panel's evidence into another.
  const twin = await openPanel("?panel=twin&twin=regions");
  const tabs = twin.page.getByRole("tablist", { name: "Twin views" });
  await expect(tabs).toBeVisible({ timeout: 30000 });
  await expect(twin.page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(twin.page.getByRole("region", { name: "Body composition" })).toBeVisible({
    timeout: 30000,
  });

  // The figure the app ships must actually be reachable: the scene starts on
  // a generated surface and only marks itself human once the glTF has loaded,
  // so this fails if the asset is missing, unusable or served wrong.
  await expect(twin.page.locator('[data-twin-body="human"]')).toHaveCount(1, { timeout: 30000 });
  await twin.page.screenshot({ path: path.join(artifacts, "twin-overview.png"), fullPage: true });

  await twin.page.getByRole("tab", { name: "Muscles" }).click();
  const table = twin.page.getByRole("region", { name: "Every region" });
  await expect(table).toBeVisible({ timeout: 30000 });
  const tableText = await table.innerText();
  // Least recovered first, and the region with no evidence is last and blank
  // rather than sorted in among the recovered ones.
  expect(tableText.indexOf("41%")).toBeLessThan(tableText.indexOf("55%"));
  expect(tableText.indexOf("55%")).toBeLessThan(tableText.indexOf("Calves"));
  expect(tableText).toMatch(/Calves\s*\n?\s*—/);
  expect(tableText).toContain("it is not");
  // The body composition card belongs to Overview and must not follow along.
  await expect(twin.page.getByRole("region", { name: "Body composition" })).toHaveCount(0);

  await twin.page.screenshot({ path: path.join(artifacts, "twin-muscles.png"), fullPage: true });

  await twin.page.getByRole("tab", { name: "Systems" }).click();
  await expect(twin.page.getByRole("region", { name: "Live signals" })).toBeVisible({
    timeout: 30000,
  });
  const systemsText = await twin.page.innerText("body");
  expect(systemsText).toMatch(/colours come from logged sets alone/);
  await expect(table).toHaveCount(0);
  await twin.page.screenshot({ path: path.join(artifacts, "twin-systems.png"), fullPage: true });
  expect(twin.errors).toEqual([]);
  await twin.page.close();
  record("the Twin's three views each answer from their own source, and none borrows another's");

  // 14. The six optional languages carry their translations inline, beside the
  //     English, in the newer dictionary files. Nothing read them until the
  //     lookup in `translate` existed, so every one of these screens rendered
  //     in English for a German athlete. One live screen proves the read.
  const de = await open("", { locale: "de-DE" });
  const deRail = de.page.getByRole("region", { name: "Live-Signale" });
  await expect(deRail).toBeVisible({ timeout: 30000 });
  const deText = await deRail.innerText();
  expect(deText).toContain("Schlaf");
  expect(deText).toContain("Ruhepuls");
  expect(deText).toMatch(/noch nicht erfasst/i);
  expect(deText).not.toMatch(/\bSleep\b|Not recorded yet/);
  await de.page.close();
  record("the optional languages render the translation written beside the key");

  // 15. The wide screen owes the same explanation as the phone. With no
  //     evidence the Twin card used to reserve two thirds of the viewport for
  //     a grey silhouette and print the reason only under `sm:hidden`, and the
  //     decision card spun forever on a source that answered "nothing".
  const bare = await open("");
  const bareTwin = bare.page.getByRole("region", { name: "Your Digital Twin", exact: true });
  await expect(
    bareTwin.getByText("Not enough logged training to estimate recovery.", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  // The body shares a grid row with the other panels. Measure the figure's
  // actual stage, not the card stretched to a neighbouring panel's height.
  const stage = await bareTwin.locator(".twin-cockpit-scene").boundingBox();
  expect(stage).not.toBeNull();
  expect(stage.height).toBeLessThanOrEqual(450);
  await bareTwin.getByRole("combobox", { name: "Inspect a region" }).selectOption("chest");
  const unknownReading = bareTwin.locator(".twin-cockpit-reading");
  await expect(unknownReading.getByText("—", { exact: true })).toBeVisible();
  await expect(unknownReading.getByText("Insufficient data", { exact: true })).toBeVisible();

  await expect(
    bare.page.getByText("We couldn't load today's decision.", { exact: false }),
  ).toBeVisible();
  await expect(bare.page.getByRole("button", { name: "Try again" })).toBeVisible();
  await bare.page.screenshot({ path: path.join(artifacts, "today-bare.png"), fullPage: true });
  expect(bare.errors).toEqual([]);
  await bare.page.close();
  record("with nothing measured, Today explains itself at full width instead of spinning");

  // 16. Sets logged without a connection are training that happened, and every
  //     screen in this app reads their absence as training that did not. While
  //     any are still on the device, the app has to say so.
  const queued = [
    {
      id: "a",
      type: "workout_set",
      timestamp: Date.parse("2026-09-04T18:00:00.000Z"),
      data: {
        sessionId: "7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa",
        exerciseSlug: "barbell-squat",
        exerciseName: "Barbell Squat",
        setNumber: 1,
        reps: 8,
        weightKg: 100,
        rpe: null,
        done: true,
        performedAt: "2026-09-04T18:00:00.000Z",
      },
    },
    {
      id: "b",
      type: "workout_set",
      timestamp: Date.parse("2026-09-04T18:03:00.000Z"),
      data: {
        sessionId: "7d1c57b8-0df2-4e87-a7a2-e9a2adf0f6aa",
        exerciseSlug: "barbell-squat",
        exerciseName: "Barbell Squat",
        setNumber: 2,
        reps: 8,
        weightKg: 100,
        rpe: null,
        done: true,
        performedAt: "2026-09-04T18:03:00.000Z",
      },
    },
  ];

  const seedQueue = async (query) => {
    const opened = await openPanel(query);
    await opened.page.evaluate((rows) => window.__offlineFixture.seed(rows), queued);
    await opened.page.reload();
    return opened;
  };

  const stuck = await seedQueue("?panel=offline&sync=fail");
  const strip = stuck.page.getByText("Sets not sent yet: 2");
  await expect(strip).toBeVisible({ timeout: 30000 });
  await expect(
    stuck.page.getByText("Only this account's records are shown.", { exact: false }),
  ).toBeVisible();
  await stuck.page.screenshot({ path: path.join(artifacts, "offline-queue.png") });
  await stuck.page.close();

  // Delivered, the strip has nothing left to report and gets out of the way.
  const sent = await seedQueue("?panel=offline");
  await expect
    .poll(() => sent.page.evaluate(async () => (await window.__offlineFixture.read()).length), {
      timeout: 30000,
    })
    .toBe(0);
  await expect(sent.page.getByText("Sets not sent yet: 2")).toHaveCount(0, { timeout: 30000 });
  expect(await sent.page.evaluate(() => window.__offlineFixture.read())).toEqual([]);
  expect(sent.errors).toEqual([]);
  await sent.page.close();
  record("sets stuck on the device are reported until they are delivered");

  // 17. Everything added since the last 320px check, in Lithuanian, which runs
  //     longer than English almost everywhere. A gym phone held one-handed is
  //     the real viewport for this app, and a panel that only survives at
  //     desktop width has not shipped.
  const narrow = { locale: "lt-LT", viewport: { width: 320, height: 720 } };
  const overflowOf = (page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

  for (const [name, query] of [
    ["twin views", "?panel=twin&twin=regions"],
    ["body composition", "?panel=body&body=change&source=scan"],
    ["offline queue", "?panel=offline&sync=fail"],
  ]) {
    const page =
      query === "?panel=offline&sync=fail"
        ? await (async () => {
            const seeded = await openPanel(query, narrow);
            await seeded.page.evaluate((rows) => window.__offlineFixture.seed(rows), queued);
            await seeded.page.reload();
            return seeded;
          })()
        : await openPanel(query, narrow);

    // Wait for the panel to actually be on screen. An empty page has no
    // horizontal overflow and no controls, so measuring too early passes
    // every assertion below without looking at anything. Text, not controls:
    // the composition card in its change state legitimately has neither a
    // button nor a link.
    await page.page.waitForFunction(() => document.body.innerText.length > 120, null, {
      timeout: 60000,
    });
    await page.page.waitForTimeout(400);
    expect(await overflowOf(page.page), `${name} overflows at 320px`).toBeLessThanOrEqual(1);

    // Anything tappable has to be reachable with a thumb, not a fingernail.
    // Measured in one pass inside the page: the Twin's scene re-renders, and
    // walking Playwright locators one at a time raced with nodes detaching.
    const controls = await page.page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")]
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            label: (node.textContent ?? node.getAttribute("aria-label") ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 40),
            height: Math.round(box.height),
            width: Math.round(box.width),
          };
        })
        // Zero-sized nodes are not on screen to be tapped at all.
        .filter((control) => control.height > 0),
    );
    expect(
      controls.filter((control) => control.height < 44),
      `${name} has controls too small to tap`,
    ).toEqual([]);

    // Overflow inside a scrolling row does not push the page, so the check
    // above cannot see it: three nowrap tab labels forced into a third of the
    // width each overlapped into an unreadable smear and everything passed.
    const clipped = await page.page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")]
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => ({
          label: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
        })),
    );
    expect(clipped, `${name} has controls whose own text does not fit`).toEqual([]);
    await page.page.screenshot({
      path: path.join(artifacts, `narrow-${name.replace(/\s+/g, "-")}.png`),
      fullPage: true,
    });
    expect(page.errors).toEqual([]);
    await page.page.close();
  }
  record("the panels added since stay inside a 320px screen in Lithuanian");

  // 18. The Twin as the screen. It carries two readings from two sources at
  //     once — what the session asks of the body, and what the body has not
  //     finished recovering from — and must keep them apart.
  const home = await openPanel("?panel=home&twin=regions");
  const homeStage = home.page.getByRole("region", { name: "Your Digital Twin" });
  await expect(homeStage).toBeVisible({ timeout: 30000 });
  await expect(home.page.getByRole("heading", { name: "Upper body focus" })).toBeVisible();

  const homeText = await homeStage.innerText();
  // Both headings are uppercased by CSS, so innerText shouts them back.
  expect(homeText).toMatch(/what you train today/i);
  expect(homeText).toMatch(/still recovering/i);
  // An exercise the catalogue cannot place is named rather than dropped: the
  // body would otherwise look lighter than the session actually is.
  expect(homeText).toContain("Sled push");

  // Tapping a region says which of the two readings it is talking about.
  await homeStage.getByRole("button", { name: /Chest/ }).first().click();
  await expect(homeStage.getByText("In today's session")).toBeVisible();
  await homeStage.getByRole("button", { name: /Back/ }).first().click();
  await expect(homeStage.getByText("Not trained today")).toBeVisible();

  // The figure itself carries today's session as its own layer, opened by
  // default when there is one, with its own legend — never mixed into the
  // recovery colour, which a region can contradict.
  await expect(homeStage.getByRole("button", { name: "Today's session" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(homeStage.getByText("exercises · from your programme")).toBeVisible();
  // The week's work, as arithmetic: a total, a comparison, and the two things
  // the sum cannot include said out loud.
  const loadPanel = homeStage.getByRole("region", { name: "Training load" });
  await expect(loadPanel).toBeVisible();
  const loadText = await loadPanel.innerText();
  expect(loadText).toContain("14,580");
  expect(loadText).toContain("+18%");
  expect(loadText).toContain("12,400");
  // Three completed sets carried no weight or reps; the total says so rather
  // than quietly understating the week.
  expect(loadText).toMatch(/3 completed sets are not in this total/);

  await home.page.screenshot({ path: path.join(artifacts, "twin-home.png"), fullPage: true });

  // And recovery is one tap away, still meaning only recovery.
  await homeStage.getByRole("button", { name: "Recovery", exact: true }).click();
  await expect(homeStage.getByText("% · calculated")).toBeVisible();
  await home.page.screenshot({
    path: path.join(artifacts, "twin-home-recovery.png"),
    fullPage: true,
  });
  expect(home.errors).toEqual([]);
  await home.page.close();

  // A programme that could not be read never reads as a rest day.
  const noPlan = await openPanel("?panel=home&twin=regions&targets=fail");
  await expect(noPlan.page.getByText("Your programme could not be read")).toBeVisible({
    timeout: 30000,
  });
  await expect(noPlan.page.getByText("has no session today")).toHaveCount(0);
  await noPlan.page.close();

  const rest = await openPanel("?panel=home&twin=regions&targets=rest");
  await expect(rest.page.getByText("has no session today")).toBeVisible({ timeout: 30000 });
  // A session layer with no session is an empty answer, so a rest day opens
  // on recovery instead.
  await expect(rest.page.getByRole("button", { name: "Recovery", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await rest.page.close();
  record("the Twin screen carries today's session and today's fatigue without blurring them");

  // A first week is not an infinite improvement, and an unread source is not
  // a week without training.
  const firstWeek = await openPanel("?panel=home&twin=regions&load=first");
  await expect(firstWeek.page.getByText("no logged load last week", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await expect(firstWeek.page.getByText("%", { exact: true })).toHaveCount(0);
  await firstWeek.page.close();

  const unread = await openPanel("?panel=home&twin=regions&load=fail");
  await expect(unread.page.getByText("Your sets could not be read")).toBeVisible({
    timeout: 30000,
  });
  await expect(unread.page.getByText("No completed set in the last two weeks")).toHaveCount(0);
  await unread.page.close();
  record("the week's load says what it counted, what it could not, and what it cannot compare");

  // 19. What the last finished session did to the body, kept on the home
  //     screen. The share is a share of recorded volume, and a session whose
  //     denominator is incomplete gets no percentages at all rather than some.
  const effect = await openPanel("?panel=home&twin=regions");
  const effectPanel = effect.page.getByRole("region", { name: "Recent workout effect" });
  await expect(effectPanel).toBeVisible({ timeout: 30000 });
  const effectText = await effectPanel.innerText();
  expect(effectText).toContain("42%");
  expect(effectText).toContain("Chest");
  expect(effectText).toMatch(/not measured muscle activation/);
  await effect.page.close();

  // One set with no known volume, so no row is given a percentage — the set
  // count carries them instead.
  const partial = await openPanel("?panel=home&twin=regions&effect=partial");
  const partialPanel = partial.page.getByRole("region", { name: "Recent workout effect" });
  await expect(partialPanel).toBeVisible({ timeout: 30000 });
  const partialText = await partialPanel.innerText();
  expect(partialText).not.toContain("42%");
  expect(partialText).toMatch(/denominator would be incomplete/);
  expect(partialText).toContain("7 × 4200 kg");
  await partial.page.close();

  // A split that could not be computed is not a session that trained nothing.
  const noSplit = await openPanel("?panel=home&twin=regions&effect=nobreakdown");
  await expect(noSplit.page.getByText("The workout happened", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await noSplit.page.close();
  record("the last session's effect is a share of what was logged, or says why it is not");

  // 20. The mockup draws a small line beside every signal. Ours draws one only
  //     where there is a line to draw: two readings make a shape, one does not,
  //     and inventing one would be the first fabricated trend on this screen.
  const measured = await open("?signals=measured");
  const plotted = measured.page.getByRole("region", { name: "Live signals" });
  await expect(plotted).toBeVisible({ timeout: 30000 });
  // Resting HR has three readings and gets a line; sleep has one and does not.
  await expect(plotted.getByRole("img", { name: /Resting HR/ })).toBeVisible();
  await expect(plotted.getByRole("img", { name: /^Sleep/ })).toHaveCount(0);
  // Exactly one signal is plottable, so exactly one line exists.
  expect(await plotted.locator("svg[role='img']").count()).toBe(1);
  await measured.page.screenshot({ path: path.join(artifacts, "signals-sparkline.png") });
  expect(measured.errors).toEqual([]);
  await measured.page.close();
  record("a signal gets a line only when it has two readings to draw one from");

  // 21. Where the template shows "82% · High Confidence · 512 data points".
  //     Ours shows how far each target has actually been tested, and keeps
  //     "never predicted" apart from "predicted, nothing resolved yet".
  const evidence = await open("?evidence=some");
  const evidencePanel = evidence.page.getByRole("region", { name: "Prediction evidence" });
  await expect(evidencePanel).toBeVisible({ timeout: 30000 });
  await openEvidence(evidencePanel, "Evidence details");
  const evidenceText = await evidencePanel.innerText();
  expect(evidenceText).toContain("Moderate");
  expect(evidenceText).toContain("18 tested · 22 waiting");
  // Two targets nothing has ever predicted say so, rather than being omitted
  // or shown as insufficient evidence about the athlete.
  await expect(
    evidencePanel.locator(".fl-evidence-targets").getByText("Not predicted yet", { exact: true }),
  ).toHaveCount(2);
  // No blended percentage anywhere on the panel.
  expect(evidenceText).not.toMatch(/\d+\s*%/);
  await evidence.page.screenshot({ path: path.join(artifacts, "evidence-levels.png") });
  await evidence.page.close();

  const noLedger = await open("?evidence=fail");
  await expect(
    noLedger.page.getByText("decision ledger could not be read", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await noLedger.page.close();
  record("prediction evidence is a level and a count, never a blended confidence percentage");

  // 22. Where the template shows four sleep bars that always fill a night.
  //     Ours shows only what the source actually sent, and says which of the
  //     several kinds of "nothing" it is looking at.
  const noNight = await open("?sleep=");
  const sleepPanel = noNight.page.getByRole("region", { name: "Sleep analysis" });
  await expect(sleepPanel).toBeVisible({ timeout: 30000 });
  expect(await sleepPanel.innerText()).toMatch(/no source has sent a night yet/i);
  await noNight.page.close();

  const staged = await open("?sleep=staged");
  const stagedPanel = staged.page.getByRole("region", { name: "Sleep analysis" });
  await expect(stagedPanel).toBeVisible({ timeout: 30000 });
  const stagedText = await stagedPanel.innerText();
  for (const stage of ["Deep", "REM", "Core", "Awake"]) expect(stagedText).toContain(stage);
  // A whole night was described, so the shares are shown and add to 100.
  const shares = [...stagedText.matchAll(/(\d+)\s*%/g)].map((match) => Number(match[1]));
  expect(shares.length).toBe(4);
  expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
  await staged.page.screenshot({ path: path.join(artifacts, "sleep-stages.png") });
  await staged.page.close();

  // One stage out of four: minutes, no percentages, and the reason said out
  // loud. A share of one stage would read as the whole night.
  const onlyDeep = await open("?sleep=partial");
  const onlyDeepPanel = onlyDeep.page.getByRole("region", { name: "Sleep analysis" });
  await expect(onlyDeepPanel).toBeVisible({ timeout: 30000 });
  const onlyDeepText = await onlyDeepPanel.innerText();
  expect(onlyDeepText).toContain("82 min");
  expect(onlyDeepText).not.toMatch(/\d+\s*%/);
  expect(onlyDeepText).toMatch(/did not send every stage/i);
  // Sleep the source reported and never placed in a stage is named, not
  // folded into the one stage that did arrive.
  expect(onlyDeepText).toMatch(/350 min of sleep in no stage/i);
  await onlyDeep.page.close();

  const durationOnly = await open("?sleep=duration");
  const durationPanel = durationOnly.page.getByRole("region", { name: "Sleep analysis" });
  await expect(durationPanel).toBeVisible({ timeout: 30000 });
  expect(await durationPanel.innerText()).toMatch(/sleep duration only/i);
  await durationOnly.page.close();

  const noSamples = await open("?sleep=fail");
  await expect(
    noSamples.page.getByText("sleep records could not be read", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await noSamples.page.close();
  record("the sleep panel draws only the stages a source actually reported");

  // 23. Where the template plots a seven-day performance forecast against
  //     weekdays. The plan carries no calendar and the prediction model is
  //     validated at four and twelve weeks, so this says when each region
  //     comes back — arithmetic on the fatigue already on the figure — and
  //     carries the assumption it rests on.
  const ahead = await open("?twin=regions");
  const aheadPanel = ahead.page.getByRole("region", { name: "When it comes back" });
  await expect(aheadPanel).toBeVisible({ timeout: 30000 });
  await openEvidence(aheadPanel, "Recovery estimates");
  const aheadText = await aheadPanel.innerText();
  // Back is at 55% and chest at 41%; with a 40-hour constant and an 80%
  // threshold that is 32 and 43 hours, soonest first.
  expect(aheadText).toContain("In 32 h");
  expect(aheadText).toContain("In 43 h");
  expect(aheadText.indexOf("In 32 h")).toBeLessThan(aheadText.indexOf("In 43 h"));
  // The region with no calculated recovery is counted, not dropped: an
  // outlook listing two of three regions reads as a smaller body.
  expect(aheadText).toMatch(/1 regions have no calculated recovery/i);
  // The assumption is on screen, not in a footnote somewhere else.
  expect(aheadText).toMatch(/holds only if you do not train that region/i);
  expect(aheadText).toMatch(/calculated estimate, not a measurement/i);
  // And no weekday is named anywhere, because the plan has no calendar.
  expect(aheadText).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
  await ahead.page.screenshot({ path: path.join(artifacts, "recovery-outlook.png") });
  await ahead.page.close();

  // Empty evidence must not claim every region is recovered, in either view.
  for (const query of ["?twin=empty", "?panel=recovery&twin=empty"]) {
    const unknown = await openPanel(query);
    const outlook = unknown.page.getByRole("region", { name: "When it comes back" });
    await expect(
      outlook.getByText("Not enough data to estimate recovery.", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      outlook.getByText("No region is waiting to recover", { exact: false }),
    ).toHaveCount(0);
    await unknown.page.close();
  }
  record("unknown recovery remains unknown in compact and full outlooks");

  // A source that failed must never render as a body with nothing to recover.
  const noTwin = await open("?twin=unreadable");
  await expect(
    noTwin.page.getByText("does not mean everything is recovered", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await noTwin.page.close();
  record("recovery ahead is projected arithmetic with its assumption stated, never a forecast");

  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} finally {
  if (candidateBytes)
    await writeFile(
      path.join(artifacts, "anatomy-asset.json"),
      JSON.stringify(
        {
          path: candidatePath,
          sha256: createHash("sha256").update(candidateBytes).digest("hex"),
          bytes: candidateBytes.length,
          requests: candidateRequests,
          servedAs: "/models/twin-anatomy-v1.glb",
        },
        null,
        2,
      ),
    );
  await browser?.close();
  await server?.close();
}
