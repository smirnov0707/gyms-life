/** Isolated synthetic-fixture review of the real application renderer. No user records/auth bypass. */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const artifacts = path.join(root, "test-results/human");
const candidate = JSON.parse(
  await readFile(path.join(root, "src/components/twin/human-asset.candidate.json"), "utf8"),
);
const results = [];
await mkdir(artifacts, { recursive: true });
let server, browser, page;
const errors = [];
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
const controls = async (p, open, lt = false) => {
  const toggle = p.getByRole("button", {
    name: lt ? "Vaizdo valdymas" : "View controls",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-expanded")) !== String(open)) await toggle.click();
};
const preset = async (p, name) => {
  await controls(p, true);
  await p.getByRole("button", { name, exact: true }).click();
  await controls(p, false);
  await p.locator("canvas").scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
};
const load = async (p, lang = "en") => {
  await p.goto(`http://127.0.0.1:4182/?lang=${lang}`);
  await expect(p.locator('canvas[data-twin-appearance="human"]')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(async () => Number(await p.locator("canvas").getAttribute("data-twin-frames")))
    .toBeGreaterThan(0);
};
const stop = async (p) => {
  await controls(p, true);
  await p.getByLabel("Ambient motion", { exact: true }).uncheck();
  await controls(p, false);
};
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/twin-browser"),
    publicDir: path.join(root, "public"),
    define: { "import.meta.env.VITE_TWIN_HUMAN_PREVIEW": JSON.stringify("true") },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@/lib/digital-twin.functions",
          replacement: path.join(root, "tests/twin-browser/service-stub.ts"),
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
        "three",
        "three/addons/controls/OrbitControls.js",
        "three/addons/loaders/GLTFLoader.js",
      ],
    },
    server: { host: "127.0.0.1", port: 4182, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1100 },
    reducedMotion: "reduce",
    recordVideo: { dir: path.join(artifacts, "video"), size: { width: 1280, height: 1100 } },
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await load(page);
  await stop(page);
  const canvas = page.locator("canvas");
  await page.evaluate(() => {
    window.__reviewCanvas = document.querySelector("canvas");
  });
  expect(Number(await canvas.getAttribute("data-human-bytes"))).toBe(candidate.byteLength);
  expect(Number(await canvas.getAttribute("data-human-triangles"))).toBeLessThanOrEqual(100000);
  await writeFile(
    path.join(artifacts, "render-metrics.json"),
    JSON.stringify(
      {
        environment: "GitHub runner Chromium SwiftShader; NOT physical phone FPS/battery",
        asset: candidate,
        drawCalls: Number(await canvas.getAttribute("data-twin-draw-calls")),
        triangles: Number(await canvas.getAttribute("data-twin-triangles")),
      },
      null,
      2,
    ),
  );
  for (const [button, file] of [
    ["Front", "front"],
    ["Back", "back"],
    ["Left side", "left"],
    ["Right side", "right"],
  ]) {
    await preset(page, button);
    await page.screenshot({ path: path.join(artifacts, `human-${file}.png`), fullPage: true });
    await canvas.screenshot({ path: path.join(artifacts, `body-${file}.png`) });
  }
  await preset(page, "Front");
  await preset(page, "Rotate right");
  await preset(page, "Rotate right");
  await canvas.screenshot({ path: path.join(artifacts, "body-three-quarter.png") });
  const visited = [];
  for (let i = 0; i < 16; i++) {
    await preset(page, "Rotate right");
    visited.push(Number(await canvas.getAttribute("data-twin-yaw")));
  }
  expect(visited.some((n) => n > 1)).toBe(true);
  expect(visited.some((n) => n < -1)).toBe(true);
  record("actual textured human loads; all sides and a full orbit are rendered");

  await preset(page, "Front");
  await page.getByLabel("Inspect a region", { exact: true }).selectOption("chest");
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  const yaw = await canvas.getAttribute("data-twin-yaw");
  const distance = await canvas.getAttribute("data-twin-distance");
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-layer", "logged_volume");
  await expect(canvas).toHaveAttribute("data-twin-natural", "false");
  expect(await canvas.getAttribute("data-twin-yaw")).toBe(yaw);
  expect(await canvas.getAttribute("data-twin-distance")).toBe(distance);
  expect(
    await page.evaluate(() => window.__reviewCanvas === document.querySelector("canvas")),
  ).toBe(true);
  await page.screenshot({ path: path.join(artifacts, "human-overlay.png"), fullPage: true });
  await page.getByRole("button", { name: "Natural appearance", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-natural", "true");
  await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  await expect(page.getByText("3,000 kg × reps", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore evidence", exact: true }).click();
  record(
    "natural appearance does not change evidence; layer, camera, canvas and selection persist",
  );

  await page.getByRole("button", { name: "Schematic", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-appearance", "schematic");
  await page.screenshot({ path: path.join(artifacts, "before-schematic.png"), fullPage: true });
  await page.getByRole("button", { name: "Human preview", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-appearance", "human", { timeout: 30000 });
  await page.screenshot({ path: path.join(artifacts, "after-human.png"), fullPage: true });
  expect(
    await page.evaluate(() => window.__reviewCanvas === document.querySelector("canvas")),
  ).toBe(true);
  record("appearance replacement keeps the original canvas and restores the schematic safely");

  const geometryReview = await page.evaluate(
    async ({ moduleUrl, descriptor }) => {
      const { inspectHumanCandidate } = await import(moduleUrl);
      return inspectHumanCandidate(descriptor);
    },
    { moduleUrl: "/@fs" + path.join(root, "tests/human-browser/probe.ts"), descriptor: candidate },
  );
  await writeFile(
    path.join(artifacts, "region-review.json"),
    JSON.stringify(geometryReview, null, 2),
  );
  expect(geometryReview.rays.find((r) => r.name === "front").region).toBe("chest");
  expect(geometryReview.rays.find((r) => r.name === "back").region).toBe("back");
  expect(geometryReview.rays.find((r) => r.name === "head").region).toBe("neutral");
  expect(geometryReview.groups.sort()).toEqual([
    "abs",
    "arms",
    "back",
    "chest",
    "core",
    "glutes",
    "legs",
    "shoulders",
  ]);
  record(
    "actual nearest-surface region selection cannot select chest through back or neutral head",
  );

  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('canvas[data-twin-appearance="human"]')).toBeVisible({
    timeout: 30000,
  });
  await page
    .locator("canvas")
    .evaluate((node) =>
      (node.getContext("webgl2") || node.getContext("webgl"))
        .getExtension("WEBGL_lose_context")
        .loseContext(),
    );
  await expect(
    page.getByText("3D is unavailable on this device. Your evidence is still available in 2D.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try 3D again", exact: true }).click();
  await expect(page.locator('canvas[data-twin-appearance="human"]')).toBeVisible({
    timeout: 30000,
  });
  record("manual fallback and actual WebGL loss preserve data and allow recovery");

  await page.setViewportSize({ width: 1600, height: 2200 });
  await page.locator("[data-twin-viewport]").evaluate((node) => {
    node.style.height = "1800px";
  });
  await preset(page, "Front");
  await page.locator("canvas").screenshot({ path: path.join(artifacts, "human-detail-front.png") });
  await context.close();

  for (const width of [320, 375, 390, 430]) {
    const mobile = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    page = await mobile.newPage();
    const lt = width === 320;
    await load(page, lt ? "lt" : "en");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    expect(overflow).toBe(false);
    const taps = await page
      .locator("[data-human-preview] button")
      .evaluateAll((nodes) =>
        nodes.every(
          (n) => n.getBoundingClientRect().height >= 44 && n.getBoundingClientRect().width >= 44,
        ),
      );
    expect(taps).toBe(true);
    await page.screenshot({
      path: path.join(artifacts, `mobile-${width}${lt ? "-lt" : ""}.png`),
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole("button", { name: "Light theme", exact: true }).click();
      await page.screenshot({
        path: path.join(artifacts, "human-light-theme.png"),
        fullPage: true,
      });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "32px";
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: path.join(artifacts, "human-large-text.png"), fullPage: true });
    }
    await mobile.close();
  }
  record("320/375/390/430px, Lithuanian, 44px targets, light theme and large text remain usable");

  const failed = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await failed.newPage();
  await page.route("**/assets/humans/**/human.glb", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("http://127.0.0.1:4182");
  await expect(page.getByRole("button", { name: "Retry human model", exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('canvas[data-twin-appearance="schematic"]')).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await failed.close();
  record("missing human asset falls back without hiding evidence or losing 2D");
  expect(errors).toEqual([]);
} catch (error) {
  results.push({ name: "human review", status: "failed", error: String(error) });
  if (page && !page.isClosed()) {
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
    const diagnostic = await page
      .evaluate(
        async ({ moduleUrl, descriptor }) => {
          try {
            const { inspectHumanCandidate } = await import(moduleUrl);
            return await inspectHumanCandidate(descriptor);
          } catch (error) {
            return { loaderError: String(error) };
          }
        },
        {
          moduleUrl: "/@fs" + path.join(root, "tests/human-browser/probe.ts"),
          descriptor: candidate,
        },
      )
      .catch((error) => ({ error: String(error) }));
    await writeFile(
      path.join(artifacts, "loader-diagnostic.json"),
      JSON.stringify(diagnostic, null, 2),
    );
    await writeFile(
      path.join(artifacts, "page-diagnostic.txt"),
      await page
        .locator("body")
        .innerText()
        .catch(() => "unavailable"),
    );
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify(
      { results, errors, synthetic: true, physicalDeviceTest: false, visualAcceptance: "pending" },
      null,
      2,
    ),
  );
  await browser?.close();
  await server?.close();
}
