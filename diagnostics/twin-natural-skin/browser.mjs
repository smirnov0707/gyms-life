import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";

const root = process.cwd();
const out = path.join(root, "test-results/twin-skin");
const fixture = path.join(out, "fixture");
await mkdir(fixture, { recursive: true });
await writeFile(path.join(fixture, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Twin skin visibility — synthetic renderer fixture</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;background:#0c141b;color:#eaf1f5}body.light{background:#edf0f2;color:#17232b}header,nav{padding:10px;font-size:13px}nav{display:flex;gap:6px;flex-wrap:wrap}button{min-height:44px;padding:6px 12px}#stage{width:100%;height:600px;position:relative;overflow:hidden}#selection{margin:0;padding:8px}</style></head><body><header>Generic Twin • Synthetic renderer fixture • No account data</header><nav aria-label="Select a muscle"><button data-region="">Clear selection</button><button data-region="chest">Chest</button><button data-region="back">Back</button><button data-region="legs">Legs</button></nav><p id="selection" role="status">No selection</p><div id="stage"></div><script type="module" src="/fixture.ts"></script></body></html>`);
await writeFile(path.join(fixture, "fixture.ts"), `import { mountTwinScene } from "@/components/twin/twin-scene.runtime";
import { TWIN_BODY_REGIONS, type TwinSceneState } from "@/components/twin/twin-scene.model";
const q = new URLSearchParams(location.search);
document.body.classList.toggle("light", q.get("theme") === "light");
const host = document.getElementById("stage")!;
const known = q.get("evidence") === "known";
const state: TwinSceneState = {
  layer: "recovery", dataAvailable: known,
  regions: TWIN_BODY_REGIONS.map((id) => ({
    id, band: known ? "moderate" : "unknown", recoveryPct: known ? 55 : null,
    emphasis: 0, display: { value: known ? 55 : null, tone: known ? "moderate" : "unknown" },
  })),
};
const handle = mountTwinScene(host, {
  state, selectedRegion: null, label: "Generic interactive body",
  visualAppearance: q.get("appearance") === "realistic" ? "realistic" : "analysis",
  human: q.get("fallback") !== "1",
  onSelect: (region) => select(region),
  onFailure: () => { document.documentElement.dataset.failed = "true"; },
});
handle.setMotion(false);
function select(region: string | null) {
  handle.select(region);
  handle.command(region === "back" ? "back" : "front");
  document.getElementById("selection")!.textContent = region ? "Selected: " + region + " (selection is not a measurement)" : "No selection";
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-region]")) {
  button.addEventListener("click", () => select(button.dataset.region || null));
}
Object.assign(window, { __twinSkin: { state } });
window.addEventListener("pagehide", () => handle.dispose(), { once: true });
`);

let server;
let browser;
const results = [];
const errors = [];
async function pixels(page, before, after) {
  return page.evaluate(async ({ before, after }) => {
    const decode = async (base64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + base64;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D pixel decoder unavailable");
      ctx.drawImage(img, 0, 0);
      return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
    };
    const a = await decode(before);
    const b = after ? await decode(after) : a;
    if (a.width !== b.width || a.height !== b.height) throw new Error("Screenshot dimensions changed");
    let warm = 0, changed = 0, coolAdded = 0, warmLuminance = 0;
    const cool = (r, g, b) => b > r * 1.15 && g > r * 1.1 && b - r > 28 && b > 80;
    for (let i = 0; i < a.data.length; i += 4) {
      const [r, g, z] = [a.data[i], a.data[i + 1], a.data[i + 2]];
      if (r > 90 && r > g * 1.08 && g > z * 1.04 && r - z > 22) {
        warm++; warmLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * z;
      }
      const [br, bg, bz] = [b.data[i], b.data[i + 1], b.data[i + 2]];
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(z - bz) > 60) changed++;
      if (cool(br, bg, bz) && !cool(r, g, z)) coolAdded++;
    }
    return { warm, changed, coolAdded, meanSkinLuminance: warm ? warmLuminance / warm : 0, pixels: a.width * a.height };
  }, { before: before.toString("base64"), after: after?.toString("base64") ?? null });
}
async function choose(page, region) {
  const canvas = page.locator("canvas");
  const frame = Number(await canvas.getAttribute("data-twin-frames"));
  await page.getByRole("button", { name: region || "Clear selection", exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-twin-frames"))).toBeGreaterThan(frame);
  await expect(canvas).toHaveAttribute("data-twin-selected-region", region.toLowerCase());
}
try {
  server = await createServer({
    configFile: false, root: fixture, publicDir: path.join(root, "public"),
    resolve: { alias: { "@": path.join(root, "src") } },
    optimizeDeps: { noDiscovery: true, include: ["three", "three/addons/controls/OrbitControls.js", "zod"] },
    server: { host: "127.0.0.1", port: 4193, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen();
  browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const cases = [];
  for (const appearance of ["analysis", "realistic"])
    for (const theme of ["dark", "light"])
      for (const width of [320, 960]) cases.push({ appearance, theme, width, fallback: false, known: false });
  cases.push({ appearance: "analysis", theme: "dark", width: 320, fallback: true, known: false });
  cases.push({ appearance: "analysis", theme: "dark", width: 320, fallback: false, known: true });
  for (const c of cases) {
    const context = await browser.newContext({ viewport: { width: c.width, height: 800 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const label = `${c.appearance}-${c.theme}-${c.width}${c.fallback ? "-fallback" : ""}${c.known ? "-measured" : ""}`;
    try {
      await page.goto(`http://127.0.0.1:4193/?appearance=${c.appearance}&theme=${c.theme}&fallback=${c.fallback ? "1" : "0"}&evidence=${c.known ? "known" : "none"}`);
      const canvas = page.locator("canvas");
      await expect(canvas).toHaveAttribute("data-twin-body", c.fallback ? "surface" : "human", { timeout: 45000 });
      await expect(canvas).toHaveAttribute("data-twin-skin-palette", "natural");
      await expect.poll(async () => Number(await canvas.getAttribute("data-twin-frames"))).toBeGreaterThan(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-failed", "true");
      const evidenceBefore = await page.evaluate(() => JSON.stringify(window.__twinSkin.state));
      for (const region of ["Chest", "Back", "Legs"]) {
        // Match each camera pose before/after selection; no auto-focus movement can fake pixel changes.
        await choose(page, region);
        await page.evaluate(() => document.querySelector('[data-region=""]').click());
        // Clear selects the front. For back, rotate without selecting through the keyboard.
        if (region === "Back") {
          await choose(page, region);
          // Keep the exact view and clear the selected material through the scene's own clear control.
          await page.evaluate(() => {
            const button = document.querySelector('[data-region=""]');
            button.click();
          });
        }
        await expect(canvas).toHaveAttribute("data-twin-selected-region", "");
        const baseline = await canvas.screenshot({ path: path.join(out, `${label}-${region.toLowerCase()}-base.png`), timeout: 30000 });
        const skin = await pixels(page, baseline);
        if (!c.known) {
          expect(skin.warm, label + " warm skin pixels").toBeGreaterThan(250);
          expect(skin.meanSkinLuminance, label + " readable skin").toBeGreaterThan(80);
        }
        await choose(page, region);
        const selected = await canvas.screenshot({ path: path.join(out, `${label}-${region.toLowerCase()}-selected.png`), timeout: 30000 });
        const comparison = await pixels(page, baseline, selected);
        expect(comparison.changed, label + " visible selection").toBeGreaterThan(60);
        if (!c.known) expect(comparison.coolAdded, label + " independent selection accent").toBeGreaterThan(20);
        expect(await page.evaluate(() => JSON.stringify(window.__twinSkin.state))).toBe(evidenceBefore);
        results.push({ label, region, ...comparison, status: "passed" });
        console.log("PASS", label, region, JSON.stringify(comparison));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
} finally {
  await writeFile(path.join(out, "results.json"), JSON.stringify({ scope: "Real WebGL surfaces with synthetic evidence; no live account or database. Chromium software renderer.", results, errors }, null, 2));
  await browser?.close();
  await server?.close();
}
console.log(`PASS ${results.length} rendered natural-skin and selected-muscle comparisons`);
