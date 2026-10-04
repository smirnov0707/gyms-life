import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

/**
 * Does the deployed page actually render, or does it merely answer 200?
 *
 * `smoke:production` reads ten HTTP responses and the title in the markup. A
 * page can serve a correct document, throw on hydration and show the visitor a
 * blank screen, and every one of those checks still passes. Nothing looked at
 * the rendered result, and this repository ships to production on every
 * verified change.
 *
 * So this renders the public routes in a real browser and asserts the things a
 * blank or broken page cannot satisfy: no uncaught error, no failed request to
 * our own origin, a painted background, visible text, no sideways scroll, and
 * the palette token the stylesheet in this working tree declares — which also
 * catches a deploy serving an older bundle.
 *
 *   npm run smoke:production:browser
 *
 * It checks what a visitor gets, so it needs no credentials and signs in to
 * nothing.
 */

const root = process.cwd();
const ORIGIN = process.env.GYMSLIFE_ORIGIN ?? "https://gyms.life";
const OUT = path.join(root, "test-results/production-browser");

/** The palette this tree declares, so a stale bundle is a failure not a shrug. */
async function expectedPrimary() {
  const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
  // The end marker is searched for *after* the start, because `@theme` appears
  // near the top of the file and `.light {` far below it: without the offset
  // the light slice came out empty and this read nothing at all.
  const slice = (from, to) => {
    const start = styles.indexOf(from);
    if (start < 0) throw new Error(`smoke: ${from} is not a block in src/styles.css`);
    const end = styles.indexOf(to, start);
    return styles.slice(start, end > start ? end : undefined);
  };
  const read = (block) => /--primary:\s*(#[0-9a-fA-F]{6})/.exec(block)?.[1]?.toLowerCase();
  const dark = read(slice(":root {", ".dark {"));
  const light = read(slice(".light {", "@theme"));
  if (!dark || !light) throw new Error("smoke: cannot read --primary from src/styles.css");
  return { dark, light };
}

const expected = await expectedPrimary();
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});

/**
 * Some environments put a TLS-terminating proxy in front of outbound HTTPS that
 * the browser's own trust store does not know, while node's does. Rather than
 * weaken verification, the page's requests are fulfilled through node's fetch
 * there. Which mode ran is reported, because the two do not check the same
 * thing: only the direct one exercises the browser's own networking.
 */
async function canReachDirectly() {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(ORIGIN, { waitUntil: "commit", timeout: 20000 });
    return true;
  } catch {
    return false;
  } finally {
    await context.close();
  }
}
const direct = await canReachDirectly();

const results = [];
let failures = 0;

for (const route of ["/", "/auth", "/pricing"]) {
  for (const scheme of ["dark", "light"]) {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: scheme,
      });
      const page = await context.newPage();
      const errors = [];
      const blocked = [];
      page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
      page.on("requestfailed", (r) => {
        if (r.url().startsWith(ORIGIN)) blocked.push(`${r.url()}: ${r.failure()?.errorText}`);
      });

      if (!direct) {
        await page.route("**/*", async (r) => {
          const url = r.request().url();
          if (!url.startsWith(ORIGIN)) return r.abort();
          const response = await fetch(url, {
            method: r.request().method(),
            headers: r.request().headers(),
          });
          const headers = Object.fromEntries(response.headers.entries());
          delete headers["content-encoding"];
          delete headers["content-length"];
          await r.fulfill({
            status: response.status,
            headers,
            body: Buffer.from(await response.arrayBuffer()),
          });
        });
      }

      await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(1200);

      const seen = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return {
          title: document.title,
          primary: root.getPropertyValue("--primary").trim().toLowerCase(),
          background: getComputedStyle(document.body).backgroundColor,
          // A blank screen is the failure this file exists for.
          text: (document.body.innerText || "").trim().length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      const why = [];
      if (errors.length) why.push(`uncaught: ${errors[0]}`);
      if (blocked.length) why.push(`blocked: ${blocked[0]}`);
      if (seen.text < 200) why.push(`only ${seen.text} characters rendered`);
      if (!seen.title) why.push("no document title");
      if (seen.overflow) why.push("horizontal overflow");
      if (seen.primary !== expected[scheme])
        why.push(`--primary is ${seen.primary}, this tree declares ${expected[scheme]}`);
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(seen.background))
        why.push("body has no painted background");

      const label = `${route} ${scheme} ${viewport.name}`;
      if (why.length) {
        failures += 1;
        console.log(`FAIL ${label} — ${why.join("; ")}`);
      } else {
        console.log(`PASS ${label} rendered: ${seen.text} chars, --primary ${seen.primary}`);
      }
      results.push({ route, scheme, viewport: viewport.name, why, ...seen });
      await context.close();
    }
  }
}

await browser.close();
await mkdir(OUT, { recursive: true });
await writeFile(
  path.join(OUT, "results.json"),
  JSON.stringify({ origin: ORIGIN, direct, expected, results }, null, 2) + "\n",
);

console.log(
  direct
    ? "Requests went over the browser's own TLS."
    : "The browser's trust store does not know this environment's proxy CA, so requests were fulfilled through node. Transport is not exercised; rendering is.",
);
if (failures) {
  console.error(`${failures} of ${results.length} rendered checks failed`);
  process.exit(1);
}
console.log(`PASS all ${results.length} rendered checks against ${ORIGIN}`);
