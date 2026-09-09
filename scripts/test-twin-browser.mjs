import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { verifyTwinLoadingLifecycle } from "./test-twin-loading-browser.mjs";

const root = process.cwd();
const candidateMode = process.env.TWIN_ANATOMY_CANDIDATE ?? "";
if (!["", "1", "clean", "pose", "muscular"].includes(candidateMode))
  throw new Error(`Unknown anatomy candidate: ${candidateMode}`);
const candidate = candidateMode !== "";
const candidatePath =
  candidateMode === "muscular"
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
const artifacts = path.join(root, candidate ? "test-results/twin-candidate" : "test-results/twin");
// A failed pose run must not leave clean-model screenshots beside pose metadata.
if (candidate) await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });
const results = [];
let server;
let browser;
let page;
const viewControls = async (target, open) => {
  const toggle = target.getByRole("button", { name: "View controls", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== String(open)) await toggle.click();
};
const preset = async (target, name) => {
  await viewControls(target, true);
  await target.getByRole("button", { name, exact: true }).click();
  await viewControls(target, false);
  // Closing controls can scroll the on-demand scene out of view. Sample its
  // camera only after it is visible and has painted the command.
  await target.locator("canvas").scrollIntoViewIfNeeded();
  await target.waitForTimeout(150);
};
const stopMotion = async (target) => {
  await viewControls(target, true);
  await target.getByLabel("Ambient motion", { exact: true }).uncheck();
  await viewControls(target, false);
};
const loaded = async (target) => {
  await target.goto("http://127.0.0.1:4179");
  await expect(target.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(async () => Number(await target.locator("canvas").getAttribute("data-twin-frames")))
    .toBeGreaterThan(0);
  if (candidate) expect(candidateRequests).toBeGreaterThan(0);
};
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
};
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/twin-browser"),
    publicDir: path.join(root, "public"),
    plugins: [...(candidate ? [candidatePlugin] : []), react(), tailwindcss()],
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
      ],
    },
    server: { host: "127.0.0.1", port: 4179, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({
    // CI runs `npx playwright install`, so it needs nothing here. Elsewhere —
    // a container with a pre-installed Chromium, a machine that cannot reach
    // the download host — this points the harness at an existing binary.
    // Without it these checks only ever run in CI, which is a poor place to
    // discover you have broken them.
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await loaded(page);
  await preset(page, "Front");
  await stopMotion(page);
  const expectedSource = candidateMode === "muscular" ? "makehuman" : "bodyparts3d";
  const expectedCredit =
    candidateMode === "muscular" ? "MakeHuman graphical assets (CC0)" : "BodyParts3D";
  const expectedBytes =
    candidateBytes ?? (await readFile(path.join(root, "public/models/twin-anatomy-v1.glb")));
  const expectedSha = createHash("sha256").update(expectedBytes).digest("hex");
  await expect(page.locator("canvas")).toHaveAttribute("data-twin-asset-sha256", expectedSha);
  await expect(page.locator("[data-twin-stage]")).toHaveAttribute(
    "data-twin-source",
    expectedSource,
  );
  await expect(page.locator("[data-twin-credit]")).toContainText(expectedCredit);
  await expect(page.locator("[data-twin-candidate-status]")).toHaveCount(candidate ? 1 : 0);
  record("visible model source and review status match the exact downloaded GLB");
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(artifacts, "desktop-front.png"), fullPage: true });
  const canvas = page.locator("canvas");
  const visited = [];
  for (let step = 0; step < 16; step++) {
    await preset(page, "Rotate right");
    await page.waitForTimeout(60);
    visited.push(Number(await canvas.getAttribute("data-twin-yaw")));
  }
  console.log("Orbit samples", JSON.stringify(visited));
  await writeFile(path.join(artifacts, "orbit-samples.json"), JSON.stringify(visited));
  expect(visited.some((angle) => angle > 1)).toBe(true);
  expect(visited.some((angle) => angle < -1)).toBe(true);
  expect(Math.abs(Math.sin(visited.at(-1)))).toBeLessThan(0.05);
  record("full 360-degree horizontal orbit");

  await preset(page, "Reset view");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  // A point on the pectoral, right of the sternum. The pectoralis sits between
  // 1.17 m and 1.40 m on a 1.70 m figure, the camera looks at 0.88 m, and the
  // reset view shows about 1.85 m of height — so the muscle runs from roughly
  // 20% to 28% of the canvas height above centre. This sits in the middle of
  // that, and clear of the sternum groove, where there is no muscle at all and
  // a tap now selects nothing rather than reaching the spine behind it.
  const x = box.x + box.width / 2 + 22;
  const y = box.y + box.height / 2 - box.height * 0.24;
  await page.mouse.click(x, y);
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  const beforeDrag = Number(await canvas.getAttribute("data-twin-yaw"));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 95, y + 6, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  expect(Number(await canvas.getAttribute("data-twin-yaw"))).not.toBe(beforeDrag);
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  record("mesh raycast selects chest; dragging does not select another region");

  // The profile still chooses a body variant, and the figure is now a single
  // cadaveric atlas that the loader accepts the variant for and ignores. So
  // this no longer checks that a second file downloads — it checks that
  // switching still leaves the athlete with a figure they can read and tap,
  // which is what would break if the variant were ever wired to an asset again.
  await page.getByRole("button", { name: "Female body", exact: true }).click();
  await expect
    .poll(async () => await canvas.getAttribute("data-twin-body"), { timeout: 20000 })
    .toBe("human");
  await stopMotion(page);
  await preset(page, "Reset view");
  await canvas.scrollIntoViewIfNeeded();
  const female = await canvas.boundingBox();
  await page.mouse.click(
    female.x + female.width / 2 + 22,
    // Same pectoral height as above: it is the same figure.
    female.y + female.height / 2 - female.height * 0.24,
  );
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "desktop-female.png"), fullPage: true });
  await page.getByRole("button", { name: "Male body", exact: true }).click();
  await expect
    .poll(async () => await canvas.getAttribute("data-twin-body"), { timeout: 20000 })
    .toBe("human");
  await stopMotion(page);
  await preset(page, "Reset view");
  record("the female figure loads, stands where the camera looks and picks its regions");

  const beforeZoom = Number(await canvas.getAttribute("data-twin-distance"));
  await preset(page, "Zoom in");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-twin-distance")))
    .toBeLessThan(beforeZoom);
  await canvas.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Number(await canvas.getAttribute("data-twin-yaw"))).not.toBe(0);
  record("zoom and keyboard camera controls");

  const evidence = page.getByRole("button", { name: "Why this estimate?", exact: true });
  await expect(evidence).toHaveAttribute("aria-expanded", "false");
  await evidence.click();
  await expect(page.getByText("3,000 kg × reps", { exact: true })).toBeVisible();
  await expect(page.getByText(/Wearable physiology is not included/)).toBeVisible();
  await evidence.click();
  await viewControls(page, true);
  await page.getByRole("button", { name: "Front", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "View controls", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  record("progressive evidence disclosure and Escape return focus without losing the scene");

  // Changing a presentation layer must not remount WebGL or reset the user's camera.
  const identity = await canvas.elementHandle();
  const layerYaw = await canvas.getAttribute("data-twin-yaw");
  const layerZoom = await canvas.getAttribute("data-twin-distance");
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-layer", "logged_volume");
  expect(await canvas.evaluate((element, previous) => element === previous, identity)).toBe(true);
  expect(await canvas.getAttribute("data-twin-yaw")).toBe(layerYaw);
  expect(await canvas.getAttribute("data-twin-distance")).toBe(layerZoom);
  await page.getByLabel("Inspect a region", { exact: true }).selectOption("chest");
  await expect(page.locator("[data-twin-reading-value]")).toContainText("3,000");
  await expect(page.locator("[data-twin-reading-value]")).toContainText("kg × reps");
  await page.getByText("Model & evidence", { exact: true }).click();
  await expect(page.locator('[data-twin-legend="logged_volume"]')).toContainText(
    "Relative logged volume",
  );
  await page.getByText("Model & evidence", { exact: true }).click();
  await preset(page, "Front");
  await page.screenshot({ path: path.join(artifacts, "desktop-volume.png"), fullPage: true });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-twin-stage="2d"]')).toHaveAttribute(
    "data-twin-layer",
    "logged_volume",
  );
  await expect(page.locator("[data-twin-viewport] svg")).toContainText("3,000 kg × reps");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-twin-layer", "logged_volume");
  record("layer changes preserve camera and selection; volume units agree in 3D and 2D");

  await page.getByRole("button", { name: "Fail source", exact: true }).click();
  await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
  expect(await page.locator("select").textContent()).not.toContain("3,000");
  await page.getByRole("button", { name: "Recovery", exact: true }).click();
  await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
  expect(await page.locator("select").textContent()).not.toContain("Fresh");
  await page.getByRole("button", { name: "Restore source", exact: true }).click();
  await expect(page.locator("[data-twin-reading-value]")).toContainText("77");
  record("source failure withholds old values in both layers and restoration refreshes them");

  await page.getByLabel("Inspect a region", { exact: true }).selectOption("glutes");
  await expect(page.getByRole("heading", { name: "Glutes", exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Not enough complete, supported set data for this region. Missing weights or reps and bodyweight effort cannot produce a recovery estimate.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
  expect(await page.locator("select").textContent()).not.toContain("Fresh");
  record("unknown evidence stays unknown after selection and source updates");
  await page.getByRole("button", { name: "Restore evidence", exact: true }).click();

  await canvas.evaluate((element) =>
    element.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext(),
  );
  await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
  await expect(
    page.getByText("3D is unavailable on this device. Your evidence is still available in 2D.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try 3D again", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-twin-credit]")).toHaveCount(0);
  await expect(page.locator("[data-twin-candidate-status]")).toHaveCount(0);
  record("real WebGL context loss, retry and manual 2D fallback");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await page.getByRole("button", { name: "Toggle Twin", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle Twin", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
  record("strict-mode mount/unmount cleanup without uncaught browser errors");

  // While the figure downloads, the athlete must not be shown a stand-in body.
  // A generated mannequin used to fill the stage for as long as a 1.2 MB glTF
  // takes on a phone, painted with their recovery data, indistinguishable from
  // "this is your twin". The stage keeps its 2D map — the same data, honestly
  // drawn — until the real figure lands.
  {
    const slow = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const waiting = await slow.newPage();
    await waiting.clock.install();
    let release = () => {};
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await waiting.route("**/*.glb", async (route) => {
      await held;
      await route.continue();
    });
    await waiting.goto("http://127.0.0.1:4179/index.html");
    const stage = waiting.locator("canvas");
    await expect
      .poll(async () => await stage.getAttribute("data-twin-body"), { timeout: 20000 })
      .toBe("loading");
    // Screenshot/font capture is not the scenario's simulated download time.
    // Freeze after mounting so a slow capture cannot accidentally cross the
    // separately tested 15-second deadline before this test releases the file.
    await waiting.clock.pauseAt((await waiting.evaluate(() => Date.now())) + 1000);
    await waiting.clock.runFor(800);

    // Nothing is drawn: every pixel of the frame is the transparent stage.
    const painted = await waiting.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const shot = document.createElement("canvas");
      shot.width = canvas.width;
      shot.height = canvas.height;
      shot.getContext("2d").drawImage(canvas, 0, 0);
      const { data } = shot.getContext("2d").getImageData(0, 0, shot.width, shot.height);
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) lit += 1;
      }
      return lit;
    });
    expect(painted).toBe(0);

    // And the 2D map is what the athlete is looking at meanwhile, so the
    // wait costs them the figure, not their data.
    await expect(waiting.locator("[data-twin-stage]")).toHaveAttribute("data-twin-stage", "2d");
    await expect(waiting.getByRole("status").filter({ hasText: "Preparing 3D" })).toBeVisible();
    await expect(waiting.locator("[data-twin-credit]")).toHaveCount(0);
    await waiting.screenshot({ path: path.join(artifacts, "loading-placeholder.png") });

    release();
    await waiting.clock.resume();
    await expect
      .poll(async () => await stage.getAttribute("data-twin-body"), { timeout: 30000 })
      .toBe("human");
    await expect(waiting.locator("[data-twin-stage]")).toHaveAttribute("data-twin-stage", "3d");
    await waiting.close();
    await slow.close();
  }
  record("no stand-in body while the figure loads; the 2D map holds the stage");
  {
    const unavailable = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const recovering = await unavailable.newPage();
    await recovering.route("**/*.glb", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><p>Unavailable model</p>",
      }),
    );
    await recovering.goto("http://127.0.0.1:4179/index.html");
    await expect(recovering.locator("[data-twin-stage]")).toHaveAttribute(
      "data-twin-source",
      "generated",
      { timeout: 30000 },
    );
    await expect(recovering.locator("[data-twin-model-fallback]")).toBeVisible();
    await expect(recovering.locator("canvas")).toHaveAttribute(
      "data-twin-body-height",
      /^[0-9]+\.[0-9]+$/,
    );
    await expect(recovering.locator("[data-twin-credit]")).toHaveCount(0);
    await expect(recovering.locator("[data-twin-candidate-status]")).toHaveCount(0);
    await recovering.screenshot({
      path: path.join(artifacts, "asset-unavailable.png"),
      fullPage: true,
    });
    await recovering.getByRole("button", { name: "2D", exact: true }).click();
    await expect(recovering.locator("[data-twin-model-fallback]")).toHaveCount(0);
    await recovering.unroute("**/*.glb");
    await recovering.getByRole("button", { name: "3D", exact: true }).click();
    await expect(recovering.locator("[data-twin-stage]")).toHaveAttribute(
      "data-twin-source",
      expectedSource,
      { timeout: 30000 },
    );
    await expect(recovering.locator("[data-twin-credit]")).toContainText(expectedCredit);
    await expect(recovering.locator("[data-twin-model-fallback]")).toHaveCount(0);
    await unavailable.close();
  }
  record("unverifiable model uses an explicit fallback; retry restores the actual source");
  await verifyTwinLoadingLifecycle({
    browser,
    artifacts,
    expectedSource,
    expectedCredit,
    expectedSha,
    record,
  });
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  page = await mobile.newPage();
  await loaded(page);
  await preset(page, "Front");
  await stopMotion(page);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  const regionHeading = page.locator("[data-twin-inspector] h2");
  const regionBox = await regionHeading.boundingBox();
  expect(regionBox.y + regionBox.height).toBeLessThan(844 - 96);
  const sceneBox = await page.locator("[data-twin-viewport]").boundingBox();
  expect(sceneBox.height).toBeGreaterThanOrEqual(240);
  const settingsBox = await page
    .getByRole("button", { name: "View controls", exact: true })
    .boundingBox();
  expect(settingsBox.width).toBeGreaterThanOrEqual(44);
  expect(settingsBox.height).toBeGreaterThanOrEqual(44);
  record(
    "mobile selected region is visible above a reserved 96px dock and controls have touch targets",
  );
  const mobileCanvas = page.locator("canvas");
  await expect(mobileCanvas).toHaveAttribute("data-twin-body", "human", { timeout: 30000 });
  // The app enables smooth scrolling. Finish test positioning before sampling
  // touch coordinates, then wait for an actual visible paint with motion off.
  await mobileCanvas.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }),
  );
  const framesBeforeReset = Number(await mobileCanvas.getAttribute("data-twin-frames"));
  await mobileCanvas.press("Home");
  await expect
    .poll(async () => Number(await mobileCanvas.getAttribute("data-twin-frames")))
    .toBeGreaterThan(framesBeforeReset);
  await page.screenshot({ path: path.join(artifacts, "mobile-before-pinch.png") });
  const mobileBox = await mobileCanvas.boundingBox();
  const center = {
    x: mobileBox.x + mobileBox.width / 2,
    y: mobileBox.y + mobileBox.height / 2,
  };
  const client = await mobile.newCDPSession(page);
  const distanceBeforePinch = Number(await mobileCanvas.getAttribute("data-twin-distance"));
  const framesBeforePinch = Number(await mobileCanvas.getAttribute("data-twin-frames"));
  const viewportScale = await page.evaluate(() => window.visualViewport.scale);
  await mobileCanvas.evaluate((element) => {
    const events = [];
    const record = (event) => {
      events.push({
        type: event.type,
        pointerType: event.pointerType,
        pointerId: event.pointerId,
        trusted: event.isTrusted,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
      });
    };
    element.__twinPinchCapture = { events, record };
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
      element.addEventListener(type, record, { capture: true, passive: true });
  });
  try {
    // CDP synthesizes a time-based series of real touch events. A single
    // start/move/end burst can finish before Chromium delivers a useful move
    // while a software GPU is busy. This still exercises OrbitControls' two
    // pointer path; it never invokes the runtime's zoom command directly.
    await client.send("Input.synthesizePinchGesture", {
      ...center,
      scaleFactor: 1.8,
      relativeSpeed: 120,
      gestureSourceType: "touch",
    });
    await expect
      .poll(async () => Number(await mobileCanvas.getAttribute("data-twin-distance")))
      .toBeLessThan(distanceBeforePinch);
    await expect
      .poll(async () => Number(await mobileCanvas.getAttribute("data-twin-frames")))
      .toBeGreaterThan(framesBeforePinch);
    expect(await page.evaluate(() => window.visualViewport.scale)).toBe(viewportScale);
  } finally {
    const touchEvents = await mobileCanvas.evaluate((element) => {
      const { events, record } = element.__twinPinchCapture;
      for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
        element.removeEventListener(type, record, true);
      delete element.__twinPinchCapture;
      return events;
    });
    await writeFile(
      path.join(artifacts, "mobile-pinch.json"),
      JSON.stringify(
        {
          center,
          mobileBox,
          distanceBeforePinch,
          distanceAfterPinch: Number(await mobileCanvas.getAttribute("data-twin-distance")),
          framesBeforePinch,
          framesAfterPinch: Number(await mobileCanvas.getAttribute("data-twin-frames")),
          viewportScale,
          touchEvents,
        },
        null,
        2,
      ),
    );
    await client.detach();
  }
  await preset(page, "Reset view");
  await page.screenshot({ path: path.join(artifacts, "mobile-front.png"), fullPage: true });
  await preset(page, "Back");
  await page.screenshot({ path: path.join(artifacts, "mobile-back.png"), fullPage: true });
  await preset(page, "Left side");
  await page.screenshot({ path: path.join(artifacts, "mobile-side.png"), fullPage: true });
  await page.getByRole("button", { name: "Logged volume", exact: true }).click();
  await page.getByLabel("Inspect a region", { exact: true }).selectOption("chest");
  await preset(page, "Front");
  await page.screenshot({ path: path.join(artifacts, "mobile-volume.png"), fullPage: true });
  await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
  await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
  expect(await page.locator("select").textContent()).not.toContain("kg × reps");
  await page.getByRole("button", { name: "Restore evidence", exact: true }).click();
  await expect(page.locator("[data-twin-reading-value]")).toContainText("3,000");
  record("mobile volume selection and missing-evidence updates");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  record("mobile two-finger zoom, front/back/side views and 320px layout");
  await page.goto("http://127.0.0.1:4179/?lang=lt");
  await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tavo skaitmeninis dvynys", exact: true }),
  ).toBeVisible();
  await page.getByText("Modelis ir duomenys", { exact: true }).click();
  await expect(page.getByText("TEST-FIXTURE-NOT-USER-DATA", { exact: true })).toBeVisible();
  await page.getByText("Modelis ir duomenys", { exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Vaizdo valdymas", exact: true }).click();
  await expect(page.getByLabel("Subtilus judesys", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  record(
    "Lithuanian 320px disclosure and doubled text remain accessible without horizontal overflow",
  );
  await mobile.close();

  const reduced = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  page = await reduced.newPage();
  await loaded(page);
  await page.waitForTimeout(1000);
  const frameCount = await page.locator("canvas").getAttribute("data-twin-frames");
  await page.waitForTimeout(350);
  expect(await page.locator("canvas").getAttribute("data-twin-frames")).toBe(frameCount);
  record("reduced motion keeps 3D interactive without continuous rendering");
  await reduced.close();

  const unsupported = await browser.newContext();
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === "webgl2" ? null : original.call(this, kind, ...args);
    };
  });
  page = await unsupported.newPage();
  await page.goto("http://127.0.0.1:4179");
  await expect(
    page.getByText("3D is unavailable on this device. Your evidence is still available in 2D.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel("Inspect a region", { exact: true })).toBeVisible();
  record("WebGL unavailable preserves an accessible 2D evidence surface");
  await unsupported.close();

  // The evidence list sits outside the Twin's deliberately dark stage, on the
  // page ground. When the shell started honouring the light palette this list
  // was still painted `text-white` on `bg-white/[0.02]` — white on white, and
  // nothing failed. Measuring real computed colours is the only check that
  // catches that, so this asserts contrast rather than class names.
  const themed = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  page = await themed.newPage();
  await loaded(page);
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page
    .getByRole("button", { name: /All regions|regions/i })
    .first()
    .click();

  const contrast = await page.evaluate(() => {
    // Resolve colours through the browser rather than by parsing strings:
    // Tailwind v4 computes `oklab(...)`, and the alpha channel decides which
    // ancestor the text actually sits on. Reading both back off a canvas
    // keeps this honest about syntaxes a regex would misread.
    const probe = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
    const resolve = (value) => {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "rgba(0, 0, 0, 0)";
      probe.fillStyle = value;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    // The nearest ancestor that actually paints is what the text sits on.
    const groundOf = (node) => {
      for (let el = node; el; el = el.parentElement) {
        const colour = resolve(getComputedStyle(el).backgroundColor);
        if (colour.a > 0.5) return colour;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    // Two buttons carry this label: the stage's own ranked list, and the
    // expanded evidence list below it. The second is the one on the page
    // ground, so take the last in document order.
    const rows = [...document.querySelectorAll("button")].filter((el) =>
      (el.textContent ?? "").trim().startsWith("Chest"),
    );
    const row = rows[rows.length - 1];
    // The leaf that carries the text, not an ancestor of it. The wrapper span
    // holds only a dot and the label, so its own textContent is "Chest" too —
    // and its colour is inherited, so it stays readable even when the label's
    // own class does not. Measuring it hid the very bug this check is for.
    const label = row
      ? [...row.querySelectorAll("span")].find(
          (el) => el.childElementCount === 0 && el.textContent?.trim() === "Chest",
        )
      : undefined;
    if (!label) return null;
    const text = resolve(getComputedStyle(label).color);
    const ground = groundOf(label);
    const light = Math.max(luminance(text), luminance(ground));
    const dark = Math.min(luminance(text), luminance(ground));
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
  });

  expect(contrast).not.toBeNull();
  // WCAG AA for body text. White on white scores 1.
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: path.join(artifacts, "light-theme.png"), fullPage: true });
  record(`evidence list stays legible in the light theme (contrast ${contrast}:1)`);
  await themed.close();
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
  results.push({
    name: "browser failure",
    status: "failed",
    detail: error instanceof Error ? error.stack : String(error),
  });
  throw error;
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
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close();
  await server?.close();
}
