import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// This read-only probe exists in the test Vite transform only. It projects
// actual triangle centres and independently checks occlusion. It NEVER calls
// focus, command, onSelect, or the production near-side filtering helper.
const probe = `
    Object.defineProperty(canvas, "__twinPickingProbe", {
      value: (regionId: string) => {
        camera.updateMatrixWorld();
        twinBodyRoot.updateWorldMatrix(true, true);
        const rect = canvas.getBoundingClientRect();
        const independentRay = new Raycaster();
        const inspect = (u: number, v: number) => {
          independentRay.setFromCamera(new Vector2(u * 2 - 1, 1 - v * 2), camera);
          const hits = independentRay.intersectObjects(model.meshes, false);
          const owned = hits[0]; // The closest surface, including non-region occluders.
          return owned ? model.regionOf.get(owned.object) : null;
        };
        const candidates: Array<{ u: number; v: number; score: number }> = [];
        for (const mesh of model.regionMeshes.get(regionId) ?? []) {
          const position = mesh.geometry.getAttribute("position");
          const index = mesh.geometry.getIndex();
          const count = index?.count ?? position.count;
          for (let i = 0; i + 2 < count; i += 3) {
            const point = new Vector3();
            for (let j = 0; j < 3; j++) {
              const vertex = index ? index.getX(i + j) : i + j;
              point.add(new Vector3().fromBufferAttribute(position, vertex));
            }
            point.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld).project(camera);
            const u = (point.x + 1) / 2, v = (1 - point.y) / 2;
            if (point.z <= -1 || point.z >= 1 || u < .12 || u > .88 || v < .12 || v > .88)
              continue;
            candidates.push({ u, v, score: (u - .5) ** 2 + (v - .5) ** 2 });
          }
        }
        candidates.sort((a, b) => a.score - b.score);
        for (const point of candidates) {
          // Require a real interior patch, not an edge, gap, or hidden triangle.
          let visible = true;
          for (const dx of [-3, 0, 3]) for (const dy of [-3, 0, 3]) {
            if (inspect(point.u + dx / rect.width, point.v + dy / rect.height) !== regionId)
              visible = false;
          }
          if (!visible) continue;
          return {
            ...point, region: regionId, candidates: candidates.length,
            legacyPointHit: inspect(.6, .4),
            camera: camera.position.toArray(), target: controls.target.toArray(),
          };
        }
        return null;
      },
    });
`;
const root = process.cwd();
const out = path.join(root, "test-results/twin-navigation/picking");
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
let browser;
let failure = null;
let transformations = 0;
const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/twin-browser"),
  publicDir: path.join(root, "public"),
  plugins: [
    {
      name: "readonly-synthetic-twin-picking-probe",
      enforce: "pre",
      transform(code, id) {
        if (!id.split("?")[0].endsWith("/src/components/twin/twin-scene.runtime.ts")) return;
        const anchor = "    const up = (event: PointerEvent) => {";
        assert.equal(code.split(anchor).length, 2, "Picking probe anchor changed");
        transformations++;
        return { code: code.replace(anchor, probe + anchor), map: null };
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
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const width of [320, 390, 1280]) {
    for (const theme of ["dark", "light"]) {
      for (const appearance of ["realistic", "analysis"]) {
        const lt = width < 600;
        const name = `${width}-${theme}-${appearance}`;
        const context = await browser.newContext({
          viewport: { width, height: lt ? 844 : 1000 },
          locale: lt ? "lt-LT" : "en-GB",
          timezoneId: "Europe/Vilnius",
          reducedMotion: "reduce",
          hasTouch: lt,
          isMobile: lt,
          deviceScaleFactor: 1,
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
        page.on("response", (response) => {
          if (response.status() >= 400)
            errors.push(`${name}: HTTP ${response.status()} ${response.url()}`);
        });
        try {
          await page.goto(`${origin}/navigation.html?lang=${lt ? "lt" : "en"}&theme=${theme}`);
          const stage = page.locator("[data-twin-stage]");
          const canvas = stage.locator("canvas");
          const toggle = stage.getByRole("button", {
            name: lt ? "Vaizdo valdymas" : "View controls",
            exact: true,
          });
          await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
          if (appearance === "realistic") {
            const body = page.getByRole("button", { name: lt ? "Kūnas" : "Body", exact: true });
            if (!(await body.isVisible())) await toggle.click();
            await body.click();
            if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
          }
          await expect(canvas).toHaveAttribute("data-twin-appearance", appearance);
          await expect(canvas).toHaveAttribute("data-twin-body", "human", { timeout: 45000 });
          const file = appearance === "realistic" ? "twin-body-v2.glb" : "twin-natural-v1.glb";
          const assetHash = createHash("sha256")
            .update(await readFile(path.join(root, "public/models", file)))
            .digest("hex");
          await expect(canvas).toHaveAttribute("data-twin-asset-sha256", assetHash);
          const showCanvas = async () => {
            await canvas.evaluate((el) =>
              el.scrollIntoView({ block: "center", behavior: "instant" }),
            );
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
          };
          const command = async (label) => {
            const button = stage.getByRole("button", { name: label, exact: true });
            const opened = !(await button.isVisible());
            if (opened) await toggle.click();
            await button.click();
            if (opened) await toggle.click();
            await showCanvas();
          };
          const choose = stage.getByRole("combobox", {
            name: lt ? "Apžiūrėti regioną" : "Inspect a region",
            exact: true,
          });
          const counter = page.locator("[data-camera-selections]");
          const hit = async (region) => {
            await showCanvas();
            const point = await canvas.evaluate((el, id) => el.__twinPickingProbe(id), region);
            assert.ok(point, `${name}: no visible interior ${region} triangle`);
            const box = await canvas.boundingBox();
            assert.ok(box);
            const x = box.x + box.width * point.u;
            const y = box.y + box.height * point.v;
            assert.ok(x > 0 && x < width && y > 0 && y < (lt ? 844 : 1000));
            assert.equal(
              await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x, y }),
              "CANVAS",
            );
            const before = Number(await counter.innerText());
            await canvas.screenshot({ path: path.join(out, `${name}-${region}-before.png`) });
            await page.mouse.click(x, y);
            await expect(choose).toHaveValue(region);
            await expect(counter).toHaveText(String(before + 1));
            await expect(page.locator("[data-camera-selection]")).toHaveText(region);
            await expect(page.locator("[data-twin-reading-value]")).toHaveCount(0);
            await canvas.screenshot({ path: path.join(out, `${name}-${region}-selected.png`) });
            return { ...point, x, y, before, after: Number(await counter.innerText()) };
          };
          await showCanvas();
          await canvas.press("Home");
          await expect.poll(async () => Number(await canvas.getAttribute("data-twin-yaw"))).toBe(0);
          const homeY = Number(await canvas.getAttribute("data-twin-home-y"));
          await choose.selectOption("shoulders");
          await showCanvas();
          await expect
            .poll(async () => Number(await canvas.getAttribute("data-twin-target-y")))
            .toBeGreaterThan(homeY);
          await command(lt ? "Kūno apačia" : "Lower body");
          await expect
            .poll(async () => Number(await canvas.getAttribute("data-twin-target-y")))
            .toBeLessThan(homeY);
          const leg = await hit("legs");
          await choose.selectOption("chest");
          await command(lt ? "Nugara" : "Back");
          await expect
            .poll(async () => Math.abs(Number(await canvas.getAttribute("data-twin-yaw"))))
            .toBeGreaterThan(3);
          const back = await hit("back");
          await canvas.press("Home");
          await expect.poll(async () => Number(await canvas.getAttribute("data-twin-yaw"))).toBe(0);
          await page.screenshot({ path: path.join(out, `${name}-page.png`), fullPage: true });
          results.push({ name, status: "passed", assetHash, leg, back });
          console.log(
            "PASS",
            name,
            "leg and back selected by actual canvas clicks",
            JSON.stringify({ legacyPointHit: leg.legacyPointHit, leg: [leg.u, leg.v] }),
          );
        } catch (error) {
          await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true });
          await writeFile(
            path.join(out, `${name}-failure.json`),
            JSON.stringify(
              await page.locator("canvas").evaluateAll((all) =>
                all.map((el) => ({
                  dataset: { ...el.dataset },
                  box: el.getBoundingClientRect().toJSON(),
                })),
              ),
              null,
              2,
            ),
          );
          throw error;
        } finally {
          await context.close();
        }
      }
    }
  }
  assert.equal(results.length, 12);
  assert.ok(transformations > 0, "Probe was never mounted");
  assert.deepEqual(errors, []);
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
        transformations,
        scope:
          "Unmodified production picking, real registered models and real pointer clicks. Test-only read probe projects visible triangle centres. Synthetic evidence, no physical-device acceptance.",
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await server.close();
}
