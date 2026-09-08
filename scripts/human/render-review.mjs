#!/usr/bin/env node
/** Reuse the exact v8 studio. Never treats screenshots as visual approval. */
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dependencies: { type: "string" },
    port: { type: "string", default: "4178" },
    "serve-only": { type: "boolean", default: false },
    "extra-full-body": { type: "boolean", default: false },
    "chromium-executable": { type: "string" },
    help: { type: "boolean", default: false },
  },
});
if (values.help || positionals.length !== 2) {
  console.log(
    "Usage: node scripts/human/render-review.mjs MODEL.glb OUTPUT_DIR [--dependencies REPO] [--serve-only] [--extra-full-body] [--port 4178] [--chromium-executable PATH]",
  );
  process.exit(values.help ? 0 : 1);
}

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modelPath = path.resolve(positionals[0]);
const out = path.resolve(positionals[1]);
const dependencyRoot = path.resolve(values.dependencies || repo);
const require = createRequire(path.join(dependencyRoot, "package.json"));
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
const workflowPath = path.join(repo, ".github/workflows/human-cc0-render-v8.yml");
const workflow = await readFile(workflowPath, "utf8");

function extract(name, marker) {
  const start = `          cat > ${name} <<'${marker}'\n`;
  const from = workflow.indexOf(start);
  if (from < 0) throw new Error(`Missing canonical v8 ${name}`);
  const end = workflow.indexOf(`\n          ${marker}\n`, from + start.length);
  if (end < 0) throw new Error(`Unterminated canonical v8 ${name}`);
  return (
    workflow
      .slice(from + start.length, end)
      .split("\n")
      .map((line) => {
        if (!line.startsWith("          ")) throw new Error("Unexpected studio indentation");
        return line.slice(10);
      })
      .join("\n") + "\n"
  );
}
const html = extract("human-review.html", "HTML");
const studio = extract("human-review.js", "JS");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const modelBytes = await readFile(modelPath);
if (modelBytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Expected a GLB file");
const views = [
  { name: "front", view: "front", close: "" },
  { name: "back", view: "back", close: "" },
  { name: "left", view: "left", close: "" },
  { name: "right", view: "right", close: "" },
  { name: "threeq", view: "threeq", close: "" },
  { name: "front-face", view: "front", close: "face" },
  { name: "right-hands", view: "right", close: "hands" },
  { name: "mobile-390", view: "threeq", close: "", mobile: true },
];
await mkdir(out, { recursive: true });
// Refuse to mix evidence from two candidates or overwrite an earlier review.
const manifest = {
  schemaVersion: 1,
  modelSha256: sha256(modelBytes),
  modelBytes: modelBytes.length,
  canonicalWorkflow: path.relative(repo, workflowPath),
  canonicalWorkflowSha256: sha256(workflow),
  canonicalStudioSha256: sha256(studio),
  canonicalViews: views,
  desktopViewport: [900, 1200],
  mobileViewport: [390, 844],
  deviceScaleFactor: 1,
  captured: false,
  visualGatePassed: false,
  productionEligible: false,
  limitations: [
    "Canonical framing intentionally retains v8 camera composition, including any clipping.",
    "Legacy drawCalls is a mesh counter, not measured renderer draw calls.",
    "Local Chromium screenshots do not establish physical mobile performance or visual acceptance.",
  ],
};
await writeFile(path.join(out, "review-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
  flag: "wx",
});

let browser;
let server;
const studioRoot = await mkdtemp(path.join(tmpdir(), "gyms-human-review-"));
const cleanup = async () => {
  await browser?.close();
  await server?.close();
  await rm(studioRoot, { recursive: true, force: true });
};
try {
  await access(path.join(dependencyRoot, "node_modules"));
  await symlink(
    path.join(dependencyRoot, "node_modules"),
    path.join(studioRoot, "node_modules"),
    "dir",
  );
  await writeFile(path.join(studioRoot, "human-review.html"), html);
  await writeFile(path.join(studioRoot, "human-review.js"), studio);
  // Extra framing is a distinct page. Canonical eight images remain byte-identical studio code.
  if (values["extra-full-body"]) {
    const anchor = "camera.position.set(...p);";
    if (studio.split(anchor).length !== 2) throw new Error("Canonical camera anchor changed");
    const fullFrame = `const fullDistance=Math.max(H*1.15/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))),Math.max(size.x,size.z)*1.15/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));const direction=new THREE.Vector3(...p).sub(target).normalize();p=target.clone().addScaledVector(direction,fullDistance).toArray();`;
    await writeFile(
      path.join(studioRoot, "human-review-full.html"),
      html.replace("/human-review.js", "/human-review-full.js"),
    );
    await writeFile(
      path.join(studioRoot, "human-review-full.js"),
      studio.replace(anchor, fullFrame + anchor),
    );
  }
  const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
  server = await createServer({
    configFile: false,
    root: studioRoot,
    publicDir: false,
    cacheDir: path.join(studioRoot, ".vite"),
    plugins: [
      {
        name: "exact-local-human",
        configureServer(dev) {
          dev.middlewares.use((request, response, next) => {
            if (request.url?.split("?")[0] !== "/__human_review/human.glb") return next();
            response.setHeader("Content-Type", "model/gltf-binary");
            response.setHeader("Cache-Control", "no-store");
            // Serve the exact bytes hashed above even if the source file changes later.
            response.end(modelBytes);
          });
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      fs: { allow: [studioRoot, dependencyRoot] },
    },
  });
  await server.listen();
  const base = `http://127.0.0.1:${port}`;
  console.log(
    JSON.stringify({
      url: `${base}/human-review.html`,
      out,
      modelSha256: sha256(modelBytes),
      serveOnly: values["serve-only"],
      views,
    }),
  );
  if (values["serve-only"]) {
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } else {
    // require.resolve selects Playwright's CommonJS entry. Dynamic import of
    // that file exposes only default/module.exports, not named chromium.
    const { chromium } = require("@playwright/test");
    if (typeof chromium?.launch !== "function")
      throw new Error("Playwright Chromium is unavailable");
    const executablePath =
      values["chromium-executable"] || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const captures = [...views];
    if (values["extra-full-body"])
      captures.push({
        name: "extra-full-body-mobile-390",
        view: "threeq",
        close: "",
        mobile: true,
        full: true,
      });
    const metrics = [];
    for (const view of captures) {
      const page = await browser.newPage({
        viewport: view.mobile ? { width: 390, height: 844 } : { width: 900, height: 1200 },
        deviceScaleFactor: 1,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(
        `${base}/human-review${view.full ? "-full" : ""}.html?view=${view.view}&close=${view.close}`,
      );
      await page.waitForFunction(
        () => window.__HUMAN_REVIEW__?.ready === true || window.__HUMAN_REVIEW__?.error,
        undefined,
        { timeout: 30000 },
      );
      const reading = await page.evaluate(() => window.__HUMAN_REVIEW__);
      if (!reading.ready || errors.length)
        throw new Error(JSON.stringify({ view: view.name, reading, errors }));
      await page.waitForTimeout(view.mobile ? 250 : 350);
      await page.screenshot({ path: path.join(out, `${view.name}.png`) });
      metrics.push({ view: view.name, canonical: !view.full, ...reading });
      await page.close();
    }
    await writeFile(
      path.join(out, "metrics.json"),
      JSON.stringify(
        {
          modelSha256: sha256(modelBytes),
          metrics,
          visualGatePassed: false,
          productionEligible: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    await writeFile(
      path.join(out, "review-manifest.json"),
      JSON.stringify(
        { ...manifest, captured: true, capturedViews: captures.map((view) => view.name) },
        null,
        2,
      ) + "\n",
    );
    console.log(`Captured ${captures.length} views; visual acceptance remains false.`);
  }
} finally {
  await cleanup();
}
