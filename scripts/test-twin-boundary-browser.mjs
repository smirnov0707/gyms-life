import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";

const root = process.cwd();
const out = path.join(root, "test-results/twin-boundary");
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
let browser;
let failure = null;

async function measure(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let blue = 0;
  const rows = [];
  for (let y = Math.ceil(info.height * 0.12); y < info.height * 0.86; y++) {
    const xs = [];
    for (let x = Math.ceil(info.width * 0.18); x < info.width * 0.82; x++) {
      const i = (y * info.width + x) * info.channels;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (b > 110 && g > 85 && b > r * 1.25 && g > r * 1.15) {
        blue++;
        xs.push(x);
      }
    }
    if (xs.length > 8) rows.push({ y, left: xs[0], right: xs.at(-1) });
  }
  let abruptRowChanges = 0;
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1],
      next = rows[i];
    if (next.y !== previous.y + 1) continue;
    if (Math.abs(next.left - previous.left) > 3) abruptRowChanges++;
    if (Math.abs(next.right - previous.right) > 3) abruptRowChanges++;
  }
  return { blue, abruptRowChanges, width: info.width, height: info.height };
}

try {
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const treatment of ["reference", "feathered"]) {
    let referenceTransforms = 0;
    const server = await createServer({
      configFile: false,
      root: path.join(root, "tests/twin-browser"),
      publicDir: path.join(root, "public"),
      plugins: [
        {
          // Counterfactual reference only inside this test server: bypass the
          // new mask, without any runtime/debug switch in the production app.
          name: "reference-unfeathered-back",
          enforce: "pre",
          transform(code, id) {
            if (treatment !== "reference" || !id.endsWith("/twin-human.loader.ts")) return;
            const needle = "const featherBack =";
            assert.equal(code.split(needle).length, 2);
            referenceTransforms++;
            return code.replace(needle, "const featherBack = false &&");
          },
        },
        react(),
        tailwindcss(),
      ],
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
      server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
    });
    try {
      await server.listen();
      const address = server.httpServer?.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      for (const width of [390, 1280]) {
        for (const theme of ["dark", "light"]) {
          const name = `${treatment}-${theme}-${width}`;
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            reducedMotion: "reduce",
            locale: "en-GB",
            timezoneId: "Europe/Vilnius",
          });
          await context.route("**/*", (route) => {
            const request = route.request();
            if (new URL(request.url()).origin === origin && request.method() === "GET")
              return route.continue();
            errors.push(`${name}: unexpected ${request.method()} ${request.url()}`);
            return route.abort();
          });
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(`${name}: ${error}`));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(`${name}: ${message.text()}`);
          });
          try {
            await page.goto(origin);
            if (theme === "light")
              await page.getByRole("button", { name: "Light theme", exact: true }).click();
            await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
            const toggle = page.getByRole("button", { name: "View controls", exact: true });
            const body = page.getByRole("button", { name: "Body", exact: true });
            if (!(await body.isVisible())) await toggle.click();
            await body.click();
            if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
            const canvas = page.locator("canvas");
            await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
            await expect(canvas).toHaveAttribute(
              "data-twin-asset-sha256",
              "9c3bcd90d6cd5559efb1c2f166623f711f54d52cc1e93759a9d760bc63843cad",
              { timeout: 45000 },
            );
            await page.getByRole("button", { name: "Clear evidence", exact: true }).click();
            await page.getByLabel("Inspect a region", { exact: true }).selectOption("back");
            await canvas.scrollIntoViewIfNeeded();
            await expect
              .poll(async () => Math.abs(Number(await canvas.getAttribute("data-twin-yaw"))))
              .toBeGreaterThan(3);
            await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
            const buffer = await canvas.screenshot({
              path: path.join(out, `${name}.png`),
              animations: "disabled",
            });
            const pixels = await measure(buffer);
            expect(pixels.blue).toBeGreaterThan(200);
            results.push({ treatment, theme, width, pixels });
            console.log("FRAME", JSON.stringify(results.at(-1)));
          } finally {
            await context.close();
          }
        }
      }
      if (treatment === "reference") expect(referenceTransforms).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  }
  expect(results).toHaveLength(8);
  for (const frame of results.filter((item) => item.treatment === "feathered")) {
    const before = results.find(
      (item) =>
        item.treatment === "reference" && item.theme === frame.theme && item.width === frame.width,
    );
    expect(frame.pixels.blue).toBeGreaterThan(before.pixels.blue * 0.45);
    expect(frame.pixels.blue).toBeLessThan(before.pixels.blue * 0.99);
    console.log(
      "PASS visible boundary changes while substantial back selection remains",
      frame.theme,
      frame.width,
    );
  }
  expect(errors).toEqual([]);
} catch (error) {
  failure = String(error);
  throw error;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        results,
        errors,
        failure,
        scope:
          "Generic registered body with synthetic evidence; reference bypass exists in this test transform only. Pixel edge counts are descriptive, not an anatomical or device-performance claim.",
      },
      null,
      2,
    ),
  );
  await browser?.close();
}
