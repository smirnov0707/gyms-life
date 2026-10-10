import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Renders `public/share-card.png`, the 1200x630 image a shared gyms.life link
 * shows, from the same palette and faces the site itself uses.
 *
 * Built rather than drawn by hand for the reason AGENTS.md keeps returning to:
 * a share card is a claim made before anybody reaches the page, and a claim
 * nobody rechecks drifts. The headline here is the landing hero's own words and
 * the colours are read out of `src/styles.css`, so changing either in the app
 * changes this, and `share-card.test.ts` fails if the file stops matching.
 *
 * Run with `npm run build:share-card`. Chromium comes from
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH when the environment sets one.
 */

const root = process.cwd();
const OUT = path.join(root, "public/share-card.png");
// Beside the script, not in `public/`: it is build metadata that keeps the
// card honest, not an asset the web needs.
const INPUTS = path.join(root, "scripts/share-card.inputs.json");
const WIDTH = 1200;
const HEIGHT = 630;

/** Reads a token out of the real theme, so this cannot drift from the app. */
function token(styles, name) {
  const dark = styles.slice(styles.indexOf(":root {"), styles.indexOf(".dark {"));
  const found = new RegExp(`--${name}:\\s*([^;]+);`).exec(dark);
  if (!found?.[1]) throw new Error(`share card: --${name} is not in src/styles.css`);
  return found[1].trim();
}

const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const palette = {
  background: token(styles, "background"),
  foreground: token(styles, "foreground"),
  primary: token(styles, "primary"),
  accent: token(styles, "accent"),
  muted: token(styles, "muted-foreground"),
  border: token(styles, "border"),
};

// The landing hero's own words, read from the component rather than retyped.
const landing = await readFile(path.join(root, "src/components/FutureLabLanding.tsx"), "utf8");
const english = landing.slice(landing.indexOf("  en: {"), landing.indexOf("  lt: {"));
const pick = (key) => {
  const found = new RegExp(`${key}:\\s*\n?\\s*"([^"]+)"`).exec(english);
  if (!found?.[1]) throw new Error(`share card: the landing hero has no ${key}`);
  return found[1];
};
const headline = pick("title");
const accentLine = pick("accent");
const eyebrow = pick("eyebrow");
const note = pick("note");

const [manrope, grotesk, motion] = await Promise.all([
  readFile(path.join(root, "public/fonts/manrope-variable.ttf")),
  readFile(path.join(root, "public/fonts/space-grotesk-variable.ttf")),
  readFile(path.join(root, "public/images/athletic-motion-v1.webp")),
]);

const page = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Manrope"; src: url(data:font/ttf;base64,${manrope.toString("base64")}) format("truetype"); font-weight: 200 800; }
  @font-face { font-family: "Space Grotesk"; src: url(data:font/ttf;base64,${grotesk.toString("base64")}) format("truetype"); font-weight: 300 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    background: ${palette.background};
    background-image:
      linear-gradient(90deg, ${palette.background}, transparent 95%),
      url(data:image/webp;base64,${motion.toString("base64")});
    background-size: cover;
    background-position: center;
    color: ${palette.foreground};
    font-family: "Manrope", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 80px;
  }
  .mark { display: flex; align-items: center; gap: 16px; }
  .mark svg { width: 52px; height: 52px; }
  .word { font-size: 27px; font-weight: 700; letter-spacing: 0.045em; line-height: 1; }
  .word small { display: block; font-size: 12px; font-weight: 600; letter-spacing: 0.26em; color: ${palette.muted}; margin-top: 6px; }
  .eyebrow { font-size: 17px; font-weight: 700; letter-spacing: 0.22em; color: ${palette.primary}; }
  h1 {
    font-family: "Space Grotesk", sans-serif; font-weight: 700;
    font-size: 104px; line-height: 0.9; letter-spacing: -0.06em; margin-top: 22px;
    text-transform: uppercase;
  }
  h1 .accent { color: ${palette.primary}; display: block; }
  .facts { display: flex; gap: 14px; align-items: center; margin-top: 34px; flex-wrap: wrap; }
  .fact {
    font-size: 19px; font-weight: 600; color: ${palette.foreground};
    border-right: 1px solid ${palette.border}; padding: 6px 18px 6px 0;
  }
  .fact b { color: ${palette.primary}; font-variant-numeric: tabular-nums; }
  .note { font-size: 18px; color: ${palette.muted}; }
</style></head>
<body>
  <div class="mark">
    <svg viewBox="0 0 40 40" fill="none">
      <defs><linearGradient id="g" x1="5" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#d9ff52"/><stop offset=".56" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.accent}"/>
      </linearGradient></defs>
      <rect x="1" y="1" width="38" height="38" rx="9" fill="rgb(200 250 60 / 8%)" stroke="rgb(200 250 60 / 20%)"/>
      <path d="M27 10H15L9 16V28L14 32H27L32 27V19H22V23H27V26L25 28H16L13 25V18L17 14H25L28 17L31 14L27 10Z" fill="url(#g)"/>
      <path d="M19 19H16V24H19V19Z" fill="#b8f4ff" fill-opacity=".85"/>
    </svg>
    <span class="word">GYMS.LIFE<small>FUTURE LAB</small></span>
  </div>
  <div>
    <p class="eyebrow">${eyebrow}</p>
    <h1>${headline}<span class="accent">${accentLine}</span></h1>
    <div class="facts">
      <span class="fact"><b>175</b> exercises</span>
      <span class="fact">Sets that survive a dead signal</span>
      <span class="fact">Free in beta</span>
    </div>
  </div>
  <p class="note">${note}</p>
</body></html>`;

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
const tab = await context.newPage();
await tab.setContent(page, { waitUntil: "load" });
await tab.evaluate(() => document.fonts.ready);
await mkdir(path.dirname(OUT), { recursive: true });
const shot = await tab.screenshot({ type: "png" });
await writeFile(OUT, shot);
await browser.close();

/**
 * What the picture was drawn from, beside the picture.
 *
 * The PNG is generated but committed, so editing the hero and forgetting to
 * re-run this leaves an image that says one thing while the page says another —
 * the exact drift this card was added to stop, reintroduced one level down. The
 * image itself cannot be compared against source, so the inputs are written
 * here and `share-card.test.ts` recomputes them and compares.
 */
await writeFile(
  INPUTS,
  JSON.stringify({ headline, accent: accentLine, eyebrow, note, palette }, null, 2) + "\n",
);

console.log(`share card: ${OUT} (${WIDTH}x${HEIGHT}, ${(shot.length / 1024).toFixed(0)} KB)`);
console.log(`headline:   ${headline} ${accentLine}`);
