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

  const openPanel = async (query = "", options = {}) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      ...options,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:4183/index.html${query}`);
    return { page, errors };
  };

  const open = async (query = "", options = {}) => {
    const opened = await openPanel(query, options);
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
  await expect(rail.getByRole("link", { name: "Connect a device" })).toBeVisible();
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
  const lab = await openPanel("?panel=lab");
  await expect(lab.page.getByText("LAB STATUS")).toBeVisible({ timeout: 30000 });
  const readyDots = lab.page.locator('[title="Evidence path available"]');
  const unknownDots = lab.page.locator('[title="Evidence status unknown"]');
  expect(await readyDots.count()).toBe(0);
  expect(await unknownDots.count()).toBeGreaterThan(0);
  await lab.page.screenshot({ path: path.join(artifacts, "screen-lab.png"), fullPage: true });
  await lab.page.close();
  record("an unread lab shows unknown modules instead of ready ones");

  // The journal's four counters all come off one query. An unread ledger must
  // not report four zeros — "you have no hypotheses" is a claim, and an empty
  // ledger is something an athlete might act on.
  const journal = await openPanel("?panel=journal");
  await expect(journal.page.locator("section").first()).toBeVisible({ timeout: 30000 });
  const counters = journal.page.locator("p.font-mono.text-2xl");
  expect(await counters.count()).toBe(4);
  expect(await counters.allInnerTexts()).toEqual(["—", "—", "—", "—"]);
  await journal.page.screenshot({
    path: path.join(artifacts, "screen-journal.png"),
    fullPage: true,
  });
  await journal.page.close();
  record("an unread journal shows dashes, not four zeroes");

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
  record("the sources row reports what arrived, and tells silence from an outage");

  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server?.close();
}
