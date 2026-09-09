import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium, webkit, expect } from "@playwright/test";
const out = path.join(process.cwd(), "test-results/application-environment");
await mkdir(out, { recursive: true });
const source = path.join(out, "guard.mjs");
await build({
  entryPoints: ["src/lib/application-environment.server.ts"],
  outfile: source,
  format: "esm",
  platform: "node",
  target: "node22",
  bundle: true,
  packages: "external",
  define: { "import.meta.env.VITE_GYMSLIFE_BUILD": "undefined" },
  logLevel: "warning",
});
const { withApplicationEnvironment } = await import(pathToFileURL(source).href);
const site = "singular-vacherin-57448d",
  id = "a".repeat(24),
  stage = "yywnpovsqifwujuxdxog",
  prod = "tqwqbjkjqzusohxdzupr";
let actions = 0;
const app = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://local.invalid");
    if (url.pathname === "/seed") {
      res.setHeader("content-type", "text/html");
      res.end("<!doctype html><h1>Synthetic storage seed</h1>");
      return;
    }
    const mode = url.searchParams.get("mode") ?? "safe-preview",
      production = mode === "safe-production";
    const manifest = {
      provider: "netlify",
      context: production ? "production" : "deploy-preview",
      target: production ? "production" : "staging",
      projectRef: production ? prod : stage,
      siteId: "0d17652b-c26c-4ada-9792-d332c7572536",
      siteName: site,
      sourceCommit: "a".repeat(40),
    };
    const context = {
      deploy: {
        id,
        context: manifest.context,
        published: mode === "accidental-publication" || production,
      },
      site: { id: manifest.siteId, name: site },
    };
    const target =
      mode === "accidental-publication" || production
        ? "https://gyms.life"
        : `https://${id}--${site}.netlify.app`;
    const request = new Request(target + url.pathname, {
      method: req.method,
      headers: {
        accept: req.headers.accept ?? "text/html",
        "accept-language": url.searchParams.get("lang") ?? "en",
      },
    });
    const answer = await withApplicationEnvironment(
      request,
      async () => {
        actions++;
        return new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Synthetic allowed app</h1><label>Email<input type="email"></label>',
          { headers: { "content-type": "text/html" } },
        );
      },
      () => ({
        build: manifest,
        context: mode === "missing-runtime" ? null : context,
        databaseUrl: `https://${mode === "wrong-database" ? prod : manifest.projectRef}.supabase.co`,
      }),
    );
    res.statusCode = answer.status;
    answer.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await answer.text());
  } catch {
    res.statusCode = 500;
    res.end("Synthetic harness failed");
  }
});
await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${app.address().port}`;
let browser;
const results = [],
  errors = [];
try {
  const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  for (const mode of [
    "safe-preview",
    "safe-production",
    "accidental-publication",
    "wrong-database",
    "missing-runtime",
  ]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    const requested = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        requested.push(url.origin);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(origin + "/seed");
    await page.evaluate(() => {
      localStorage.setItem("gyms_life_offline_queue_v2", "original raw queue");
      localStorage.setItem("synthetic-session", "old-account-session");
    });
    const before = actions,
      response = await page.goto(origin + "/auth?mode=" + mode);
    if (mode.startsWith("safe-")) {
      expect(response.status()).toBe(200);
      await expect(page.getByRole("textbox")).toBeVisible();
      expect(actions).toBe(before + 1);
    } else {
      expect(response.status()).toBe(503);
      await expect(page.getByRole("heading", { name: "Environment safety check" })).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      expect(actions).toBe(before);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      await page.screenshot({ path: path.join(out, mode + ".png"), fullPage: true });
    }
    expect(await page.evaluate(() => localStorage.getItem("gyms_life_offline_queue_v2"))).toBe(
      "original raw queue",
    );
    expect(await page.evaluate(() => localStorage.getItem("synthetic-session"))).toBe(
      "old-account-session",
    );
    expect(requested).toEqual([]);
    results.push({ name: mode, status: "passed" });
    console.log("PASS", mode);
    await context.close();
  }
  for (const [mode, status, target] of [
    ["safe-preview", 200, "staging"],
    ["accidental-publication", 503, "staging"],
  ]) {
    const before = actions,
      response = await fetch(origin + "/api/public/environment?mode=" + mode),
      data = await response.json();
    expect(response.status).toBe(status);
    expect(data.target).toBe(target);
    expect(data.scope).toBe("deployment_identity_only_not_authentication_or_database_acceptance");
    expect(actions).toBe(before);
    results.push({ name: `diagnostic ${mode}`, status: "passed" });
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real HTTP responses and browser rendering/storage retention; compiled guard and synthetic deployment metadata; no production publish, Supabase request or account login",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await new Promise((resolve) => app.close(resolve));
}
