import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = process.cwd();
const artifacts = path.join(root, "test-results/twin");
await mkdir(artifacts, { recursive: true });

let server;
let browser;
try {
  server = await createServer({
    configFile: false,
    root: path.join(root, "tests/twin-browser"),
    publicDir: path.join(root, "public"),
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
    server: { host: "127.0.0.1", port: 4180, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();

  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("http://127.0.0.1:4180");
  const stage = page.locator('[data-twin-stage="3d"]');
  await expect(stage).toBeVisible({ timeout: 45_000 });
  const canvas = page.locator("canvas");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-twin-frames")), { timeout: 45_000 })
    .toBeGreaterThan(0);

  // This is the proof that the GLB loaded successfully. The renderer sets this
  // only after the visual human is mounted and the analytical body is hidden.
  await expect(canvas).toHaveAttribute("data-twin-visual", "photoreal", { timeout: 45_000 });
  await expect(canvas).toHaveAttribute("data-twin-renderer", "three");

  // Region semantics must still come from the invisible canonical hit-map.
  await page.getByLabel("Inspect a region", { exact: true }).selectOption("chest");
  await expect(page.getByRole("heading", { name: "Chest", exact: true })).toBeVisible();

  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(artifacts, "desktop-photoreal-human.png"),
    fullPage: true,
  });

  expect(errors).toEqual([]);
  console.log("PASS photoreal human GLB mounted while analytical region semantics remained active");
} finally {
  await browser?.close();
  await server?.close();
}
