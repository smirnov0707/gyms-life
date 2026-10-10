import path from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = process.cwd(),
  dir = (name) => path.join(root, "tests/public-browser", name),
  output = path.join(root, "test-results/public-browser");

/**
 * The landing hero, read out of the component the page renders.
 *
 * This assertion used to carry the headline as a literal — "A stronger you." —
 * and the hero was rewritten to "Train on the record. Not on a guess." without
 * it. The check had been failing ever since and nobody saw it, because this
 * suite could not launch a browser in CI's environment at all and died before
 * its first check. Deriving the expectation means the rewrite that changes the
 * page changes the test, and a headline that silently disappears still fails.
 */
const heroHeadline = (lang) => {
  const source = readFileSync(path.join(root, "src/components/FutureLabLanding.tsx"), "utf8");
  const start = source.indexOf(`  ${lang}: {`);
  if (start < 0) throw new Error(`public suite: the landing copy has no ${lang} branch`);
  const branch = source.slice(start, start + 2000);
  const read = (key) => {
    const found = new RegExp(`${key}:\\s*\n?\\s*"([^"]+)"`).exec(branch);
    if (!found?.[1]) throw new Error(`public suite: the ${lang} hero has no ${key}`);
    return found[1];
  };
  return { title: read("title"), accent: read("accent") };
};
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: dir(""),
  publicDir: path.join(root, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/components/AppShell", replacement: dir("app.tsx") },
      { find: "@/components/Overview", replacement: dir("app.tsx") },
      ...[
        "@/lib/auth",
        "@/lib/access",
        "@/lib/payments.functions",
        "@/lib/billing",
        "@/lib/paddle",
        "@/hooks/usePaddleCheckout",
      ].map((find) => ({ find, replacement: dir("state.ts") })),
      { find: /^@tanstack\/react-start$/, replacement: dir("state.ts") },
      { find: /^@tanstack\/react-router$/, replacement: dir("router.tsx") },
      { find: "@", replacement: path.join(root, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "lucide-react",
      "sonner",
      "@radix-ui/react-slider",
      "three",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/addons/controls/OrbitControls.js",
    ],
  },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [],
  errors = [],
  captures = [];
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
const plans = (page) => page.locator("[data-plan]");
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
  // The same escape hatch `test-core-browser.mjs` already has, and the reason
  // this suite went unrun: without it Playwright looks for a headless shell
  // this environment does not install, and the suite fails before the first
  // check instead of reporting on the pages it covers.
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium"
      ? {
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
          ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
            : {}),
        }
      : {},
  );
  const open = async (query = "", width = 390, block3D = engine === "webkit") => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    if (block3D)
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (String(type).includes("webgl")) return null;
          return original.call(this, type, ...args);
        };
      });
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-public")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('16px "Manrope"'),
        document.fonts.load('16px "Space Grotesk"'),
      ]);
      await document.fonts.ready;
    });
    return { page, context };
  };
  const states = [
    { name: "home", query: "screen=home" },
    { name: "home-lt", query: "screen=home&lang=lt" },
    { name: "beta", query: "" },
    { name: "plans", query: "billing=yes" },
    { name: "subscription", query: "billing=yes&user=yes&access=cancelled" },
    { name: "unavailable", query: "billing=yes&user=yes&access=failed" },
    ...["privacy", "terms", "refund"].map((screen) => ({
      name: screen,
      query: `screen=${screen}`,
    })),
  ];
  for (const state of states)
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(`${state.query}&theme=${theme}`, width);
        if (state.name.startsWith("home")) {
          const art = page.locator(".fl-landing-hero-art");
          await expect(art).toBeVisible();
          await expect.poll(() => art.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
          const hero = page.locator(".fl-landing-hero");
          const headingSize = await hero
            .locator("h1")
            .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
          expect(headingSize).toBeGreaterThanOrEqual(width === 1440 ? 100 : 44);
          await expect(hero.locator('a[href="/auth?mode=up"]')).toBeVisible();
          await page.screenshot({
            path: path.join(output, `signature-${state.name}-${theme}-${width}.png`),
            animations: "disabled",
          });
          await page.locator(".fl-landing-preview").scrollIntoViewIfNeeded();
        }
        if (state.name.startsWith("home") && engine === "chromium") {
          await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
          await expect(page.locator("canvas")).toHaveAttribute(
            "data-twin-asset-sha256",
            "b21543c3c2113a8f95ff6843d4c6ce226352b0b61179144a663353fee2bebe70",
          );
          await expect
            .poll(async () => Number(await page.locator("canvas").getAttribute("data-twin-frames")))
            .toBeGreaterThan(0);
        }
        if (state.name.startsWith("home") && engine === "webkit") {
          await expect(page.locator("[data-twin-stage='2d']")).toBeVisible({ timeout: 45000 });
          const viewport = await page.locator("[data-twin-viewport]").boundingBox();
          const body = await page.getByRole("img", { name: "Body map, front view" }).boundingBox();
          expect(body.height).toBeGreaterThanOrEqual(viewport.height - 1);
          expect(body.width).toBeGreaterThanOrEqual(Math.min(320, viewport.width - 1));
          await page.locator(".fl-landing-preview").screenshot({
            path: path.join(output, `anatomy-${state.name}-${theme}-${width}.png`),
            animations: "disabled",
          });
        }
        if (state.name === "subscription")
          await expect(page.getByRole("button", { name: "Resume subscription" })).toBeVisible();
        if (state.name === "unavailable")
          await expect(page.getByRole("alert")).toContainText("Subscription status unavailable");
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const loadedBrandFonts = await page.evaluate(async () => {
          const [manrope, spaceGrotesk] = await Promise.all([
            document.fonts.load('16px "Manrope"'),
            document.fonts.load('16px "Space Grotesk"'),
          ]);
          return manrope.length > 0 && spaceGrotesk.length > 0;
        });
        expect(loadedBrandFonts).toBe(true);
        const mark = await page.locator(".fl-brand-mark").boundingBox();
        expect([mark.width, mark.height]).toEqual([36, 36]);
        await expect(page.getByRole("link", { name: "GYMS.LIFE Future Lab" })).toHaveAttribute(
          "href",
          "/",
        );
        const name = `public-${state.name}-${theme}-${width}.png`;
        await page.evaluate(() => scrollTo(0, 0));
        const buffer = await page.screenshot({
          path: path.join(output, name),
          fullPage: true,
          animations: "disabled",
        });
        const capture = {
          name,
          state: state.name,
          theme,
          width,
          bytes: buffer.length,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        };
        captures.push(capture);
        if (engine === "chromium") {
          console.log("PUBLIC_UI_BEGIN " + JSON.stringify(capture));
          const encoded = buffer.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("PUBLIC_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("PUBLIC_UI_END " + name);
        }
        await context.close();
        record(`${state.name} ${theme} ${width}: typography, brand and responsive layout`);
      }
  {
    const { page, context } = await open();
    for (const button of await plans(page).all()) await expect(button).toBeDisabled();
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await expect(page.locator(".fl-price-amount strong")).toHaveText(["€3", "€12", "€49"]);
    await expect(page.locator(".fl-public-notice > a")).toHaveAttribute("href", "/auth");
    await expect(page.getByText("Payments are not enabled yet", { exact: true })).toBeVisible();
    await context.close();
    record("beta keeps the three established prices, gates payments and offers free app entry");
  }
  {
    const { page, context } = await open("billing=yes");
    await plans(page).first().press("Enter");
    expect(await page.evaluate(() => window.__publicTest.navigations)).toEqual(["/auth"]);
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await context.close();
    record("anonymous plan selection navigates to authentication without checkout");
  }
  for (const access of ["loading", "failed", "owner"]) {
    const { page, context } = await open(`billing=yes&user=yes&access=${access}`);
    if (access === "failed") await expect(page.getByRole("alert")).toBeVisible();
    if (access === "owner") await expect(page.locator(".fl-pricing-account")).toBeVisible();
    for (const button of await plans(page).all()) await expect(button).toBeDisabled();
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    if (access === "failed") {
      await page.getByRole("button", { name: "Check again" }).press("Enter");
      await expect(plans(page).first()).toBeEnabled();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(await page.evaluate(() => window.__publicTest.reads)).toBe(2);
    }
    await context.close();
    record(`${access} account cannot initiate billing; failed access can be read again`);
  }
  for (const plan of ["vex_weekly", "vex_monthly", "vex_yearly"]) {
    const { page, context } = await open("billing=yes&user=yes&hold=yes");
    const button = page.locator(`[data-plan="${plan}"]`);
    await expect(button).toBeEnabled();
    await button.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => page.evaluate(() => window.__publicTest.calls.length)).toBe(1);
    for (const other of await plans(page).all()) await expect(other).toBeDisabled();
    await page.evaluate(() => window.__publicTest.release());
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([
      {
        action: "checkout",
        input: {
          priceId: plan,
          quantity: 1,
          customerEmail: "synthetic@example.invalid",
          customData: { userId: "synthetic-user" },
          successUrl: origin + "/app?checkout=success",
        },
      },
    ]);
    await context.close();
    record(`${plan} preserves checkout payload and rejects synchronous duplicate clicks`);
  }
  {
    const { page, context } = await open("billing=yes&user=yes&access=subscriber");
    await expect(
      page.getByRole("button", { name: "Cancel subscription", exact: true }),
    ).toBeVisible();
    await page.locator('[data-plan="vex_yearly"]').press("Enter");
    await expect.poll(() => page.evaluate(() => window.__publicTest.reads)).toBe(2);
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([
      { action: "switch", input: { data: { priceId: "vex_yearly" } } },
    ]);
    await context.close();
    record("active subscription changes its plan and refreshes access without a new checkout");
  }
  for (const action of ["cancel", "resume", "portal"])
    for (const failure of [false, true]) {
      const { page, context } = await open(
        `billing=yes&user=yes&access=${action === "resume" ? "cancelled" : "subscriber"}${failure ? `&fail=${action}` : "&synced=no"}`,
      );
      const button =
        action === "portal"
          ? page.locator(".fl-pricing-account-actions button").first()
          : page.getByRole("button", {
              name: action === "cancel" ? "Cancel subscription" : "Resume subscription",
              exact: true,
            });
      await expect(button).toBeVisible();
      if (action === "cancel") page.once("dialog", (dialog) => dialog.accept());
      await button.press("Enter");
      await expect.poll(() => page.evaluate(() => window.__publicTest.calls.length)).toBe(1);
      await expect(button).toBeEnabled();
      if (failure) {
        await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
        expect(await page.evaluate(() => window.__publicTest.opened)).toEqual([]);
      } else if (action === "portal") {
        expect(await page.evaluate(() => window.__publicTest.opened)).toEqual([
          { url: "https://synthetic.invalid/portal", features: "noopener,noreferrer" },
        ]);
      } else {
        await expect(page.locator("[data-sonner-toast]")).toContainText("may take a few minutes");
        expect(await page.evaluate(() => window.__publicTest.reads)).toBe(2);
      }
      await context.close();
      record(
        `${action} ${failure ? "rejection stays actionable" : "preserves its service boundary and sync status"}`,
      );
    }
  {
    const { page, context } = await open("billing=yes&user=yes&access=subscriber");
    const cancel = page.getByRole("button", { name: "Cancel subscription", exact: true });
    await expect(cancel).toBeVisible();
    page.once("dialog", (dialog) => dialog.dismiss());
    await cancel.press("Enter");
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await context.close();
    record("dismissed cancellation performs no mutation");
  }
  for (const action of ["checkout", "switch"]) {
    const { page, context } = await open(
      `billing=yes&user=yes&fail=${action}${action === "switch" ? "&access=subscriber" : ""}`,
    );
    await expect(plans(page).first()).toBeEnabled();
    await plans(page).first().press("Enter");
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    await expect(plans(page).first()).toBeEnabled();
    expect(await page.evaluate(() => window.__publicTest.calls.length)).toBe(1);
    await context.close();
    record(`failed ${action} releases pending actions without a success claim`);
  }
  for (const lang of ["en", "lt", "de", "fr", "es", "pl", "ru", "uk"]) {
    const { page, context } = await open(`lang=${lang}`, 320);
    await expect(page.locator(".fl-price-tagline").last()).toContainText("95");
    await expect(page.locator(".fl-rhythm")).toHaveCount(0);
    await expect(page.getByTestId("rhythm-sessions")).toHaveCount(0);
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
    record(`${lang} pricing stays focused on the offer without a pseudo-transformation calculator`);
  }
  for (const screen of ["privacy", "terms", "refund"])
    for (const theme of ["dark", "light"]) {
      const { page, context } = await open(`screen=${screen}&theme=${theme}&lang=lt`, 320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const toc = page.locator(".fl-legal-contents a"),
        headings = page.locator(".fl-legal-article h2");
      expect(await toc.allTextContents()).toEqual(await headings.allTextContents());
      await toc.last().press("Enter");
      expect(new URL(page.url()).hash).toBe(`#section-${screen === "refund" ? 3 : 9}`);
      await expect(headings.last()).toBeInViewport();
      for (const link of await page.locator('.fl-legal-article a[target="_blank"]').all())
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      for (const button of await page.locator(".fl-public-preferences button").all()) {
        const box = await button.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await context.close();
      record(`${screen} Lithuanian ${theme} 320px contents links and preference targets`);
    }
  {
    const { page, context } = await open();
    await page.keyboard.press("Tab");
    await expect(page.locator(".fl-public-skip")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#public-content")).toBeFocused();
    await page.getByRole("button", { name: "Light", exact: true }).press("Enter");
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.getByRole("button", { name: "LT", exact: true }).press("Enter");
    await expect(page.locator("h1")).toHaveText("Vienas planas. Viskas viduje.");
    expect(
      await page.evaluate(() => [
        localStorage.getItem("forma_theme"),
        localStorage.getItem("forma_lang"),
      ]),
    ).toEqual(["light", "lt"]);
    await context.close();
    record("skip navigation, keyboard preferences and persistence work on public pages");
  }

  for (const lang of ["en", "lt", "de", "fr", "es", "pl", "ru", "uk"]) {
    const { page, context } = await open(`screen=home&lang=${lang}`, 320);
    const lt = lang === "lt";
    // Six of the eight locales have no copy branch and fall back through
    // `baseLang` to English, which is the only reason this is a two-way split.
    const hero = heroHeadline(lt ? "lt" : "en");
    await expect(page.locator("h1")).toContainText(hero.title);
    await expect(page.locator("h1")).toContainText(hero.accent);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.fl-landing a[href="/auth?mode=up"]')).toHaveCount(3);
    await expect(page.locator('.fl-landing a[href="/exercises"]')).toHaveCount(1);
    await expect(page.locator('.fl-landing a[href="/pricing"]')).toHaveCount(1);
    expect(
      await page.locator(".fl-landing-routine li > span").evaluateAll((numbers) =>
        numbers.every((number) => {
          const range = document.createRange();
          range.selectNodeContents(number);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
          // React renders the prefix and ordinal as adjacent text nodes.
          // One line may therefore contain multiple Range rectangles.
          return rects.length > 0 && rects.every((rect) => Math.abs(rect.top - rects[0].top) < 1);
        }),
      ),
    ).toBe(true);
    const question = page.locator(".fl-landing-faq summary").first();
    await question.press("Enter");
    await expect(page.locator(".fl-landing-faq details").first()).toHaveAttribute("open", "");
    await question.press("Enter");
    await expect(page.locator(".fl-landing-faq details").first()).not.toHaveAttribute("open");
    await page.locator('a[href="#experience"]').press("Enter");
    await expect(page.locator("#experience-title")).toBeInViewport();
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await expect(page.locator("video")).toHaveCount(0);
    await context.close();
    record(
      `${lang} landing 320px: copy, registration/library/pricing links, keyboard FAQ and section navigation`,
    );
  }
  {
    const { page, context } = await open("screen=home", 390);
    if (engine === "chromium")
      await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
    else
      await expect(page.getByRole("button", { name: "Try 3D again" })).toBeVisible({
        timeout: 45000,
      });
    const region = page.getByRole("combobox", { name: "Inspect a region" });
    await region.selectOption("back");
    await expect(page.locator(".fl-landing-region strong")).toHaveText("Back");
    await expect(page.locator(".fl-landing-region")).toContainText("no personal data");
    await page.getByRole("button", { name: "View controls", exact: true }).click();
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible();
    const viewport = await page.locator("[data-twin-viewport]").boundingBox();
    const body = await page.getByRole("img", { name: /^Body map,/ }).boundingBox();
    expect(body.height).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(body.width).toBeGreaterThanOrEqual(Math.min(320, viewport.width - 1));
    if (engine === "chromium") {
      await page.getByRole("button", { name: "3D", exact: true }).click();
      await expect(page.locator('[data-twin-stage="3d"]')).toBeVisible({ timeout: 45000 });
    }
    await page.getByRole("button", { name: "View controls", exact: true }).press("Enter");
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await context.close();
    record(
      engine === "chromium"
        ? "landing selected Twin region, 2D/3D controls without personal data or writes"
        : "landing WebKit no-WebGL region and 2D controls without personal data or writes",
    );
  }
  {
    const { page, context } = await open("screen=home", 390, true);
    await expect(page.locator('[data-twin-stage="2d"]')).toBeVisible({ timeout: 45000 });
    await expect(page.getByRole("button", { name: "Try 3D again" })).toBeVisible({
      timeout: 45000,
    });
    await page.getByRole("combobox", { name: "Inspect a region" }).selectOption("legs");
    await expect(page.locator(".fl-landing-region strong")).toHaveText("Legs");
    await expect(page.locator('.fl-landing a[href="/auth?mode=up"]').first()).toBeVisible();
    await context.close();
    record("unavailable WebGL retains an honest interactive 2D fallback and registration");
  }
  {
    const { page, context } = await open("screen=home&user=yes");
    await expect(page.getByTestId("signed-in-shell")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Signed-in Today");
    await expect(page.locator(".fl-landing")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => window.__publicTest.calls)).toEqual([]);
    await context.close();
    record("signed-in root retains Today and does not mount the public anatomy demo");
  }

  expect(errors).toEqual([]);
} finally {
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real public routes, theme and translations; synthetic auth, access and payment functions. No purchase, account action or real billing certification.",
        results,
        errors,
        captures,
      },
      null,
      2,
    ) + "\n",
  );
  await browser?.close();
  await server.close();
}
