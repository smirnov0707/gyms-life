/** Multi-angle real WebGL evidence for the exact input GLB; not generated concept art. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
const [input, output] = process.argv.slice(2);
assert(input && output, "Usage: INPUT.glb OUTPUT_DIRECTORY");
await mkdir(output, { recursive: true });
assert(!(await realpath(output)).split(/[\\/]/).includes("public"));
const bytes = await readFile(input);
const sha = createHash("sha256").update(bytes).digest("hex");
const root = process.cwd();
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/twin-browser"),
  plugins: [
    {
      name: "exact-review-model",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url, "http://localhost").pathname;
          if (pathname === "/review-source.glb") {
            res.setHeader("content-type", "model/gltf-binary");
            res.end(bytes);
            return;
          }
          if (pathname !== "/") return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              req.url,
              '<html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#060e17;color:#c7dbed;font:13px Arial}header{position:absolute;inset:18px 0 auto;display:flex;justify-content:space-around;font-weight:bold}footer{position:absolute;bottom:9px;left:20px;font-size:12px}</style></head><body><header><span>FRONT</span><span>SIDE</span><span>BACK</span></header><footer>GENERIC PRESENTATION CANDIDATE · SYNTHETIC COLOR REGIONS · NOT A PERSONAL SCAN · ' +
                sha.slice(0, 16) +
                '</footer><script type="module" src="/sculpt-review.ts"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  optimizeDeps: {
    noDiscovery: true,
    include: ["three", "three/examples/jsm/loaders/GLTFLoader.js"],
  },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const rows = [];
  for (const [mode, framing] of [
    ["neutral", "full"],
    ["regions", "full"],
    ["neutral", "torso"],
    ["regions", "torso"],
  ]) {
    const page = await browser.newPage({
        viewport: { width: 1500, height: framing === "torso" ? 750 : 1000 },
      }),
      errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/?mode=${mode}&framing=${framing}`,
    );
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.screenshot({
      path: path.join(output, (framing === "torso" ? "torso-" : "") + mode + ".png"),
    });
    rows.push({
      mode,
      framing,
      triangles: Number(await page.locator("html").getAttribute("data-triangles")),
      height: Number(await page.locator("html").getAttribute("data-height")),
    });
    await page.close();
  }
  await writeFile(
    path.join(output, "render-evidence.json"),
    JSON.stringify(
      { assetSha256: sha, sourcePath: input, rows, visualGatePassed: false },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ assetSha256: sha, rows, output }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
