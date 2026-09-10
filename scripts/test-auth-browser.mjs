import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = process.cwd(),
  dir = (name) => path.join(root, "tests/auth-browser", name),
  output = path.join(root, "test-results/auth-browser");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: dir(""),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/integrations/supabase/client", replacement: dir("state.ts") },
      { find: "@/components/AppShell", replacement: dir("brand.tsx") },
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
      "zod",
      "lucide-react",
      "sonner",
    ],
  },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
let browser;
const results = [],
  errors = [];
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  const open = async (query, width = 390) => {
    const context = await browser.newContext({ viewport: { width, height: 844 } }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${origin}/index.html?${query}`);
    await expect(page.getByTestId("synthetic-auth")).toBeVisible();
    return { page, context };
  };
  const fill = async (page, signup = false) => {
    if (signup) await page.locator("#name").fill("Synthetic User");
    await page.locator("#email").fill("synthetic@example.invalid");
    await page.locator("#password").fill("Synthetic-test-only-123");
  };
  {
    const { page, context } = await open("mode=up");
    await fill(page, true);
    await page.locator("form").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect(
      page.getByRole("status").filter({ hasText: "You are not signed in yet" }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__authTest.counts.signUp)).toBe(1);
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    await expect(page.locator("#password")).toHaveValue("");
    await page.screenshot({ path: path.join(output, "confirm-email.png"), fullPage: true });
    await context.close();
    record(
      "confirmation-only signup stays on the email instruction, no false sign-in or duplicate request",
    );
  }
  {
    const { page, context } = await open("mode=up&confirm=no");
    await fill(page, true);
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => page.evaluate(() => window.__authTest.navigations)).toEqual(["/app"]);
    await context.close();
    record("immediate signup navigates once only after a real session response");
  }
  {
    const { page, context } = await open("mode=in&next=" + encodeURIComponent("/\\evil.invalid"));
    await fill(page);
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => page.evaluate(() => window.__authTest.navigations)).toEqual(["/app"]);
    expect(new URL(page.url()).origin).toBe(origin);
    await context.close();
    record("backslash open-redirect attempt cannot leave the app after sign-in");
  }
  {
    const { page, context } = await open("mode=in&fail=signIn");
    await fill(page);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    expect(await page.evaluate(() => window.__authTest.counts.signIn)).toBe(1);
    await context.close();
    record("failed sign-in keeps the form usable without navigating");
  }
  {
    const { page, context } = await open("mode=forgot");
    await page.locator("#email").fill("synthetic@example.invalid");
    await page.locator('button[type="submit"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__authTest.counts.resetRequest ?? 0))
      .toBe(1);
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    const request = await page.evaluate(() => window.__authTest.last.resetRequest);
    expect(request.redirectTo).toBe(origin + "/reset-password");
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    await context.close();
    record("password recovery request targets the current host and does not sign in");
  }
  {
    const { page, context } = await open("screen=reset");
    await expect(page.getByRole("alert")).toContainText("missing or expired");
    await expect(page.locator("#pw")).toHaveCount(0);
    await page.screenshot({
      path: path.join(output, "recovery-without-session.png"),
      fullPage: true,
    });
    await context.close();
    record("missing recovery session cannot submit a password change");
  }
  {
    const { page, context } = await open("screen=reset&session=yes");
    await page.locator("#pw").fill("Synthetic-test-only-123");
    await page.locator("#pw2").fill("different-value");
    await page.locator('button[type="submit"]').click();
    expect(await page.evaluate(() => window.__authTest.counts.updatePassword ?? 0)).toBe(0);
    await page.locator("#pw2").fill("Synthetic-test-only-123");
    await page.locator("form").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__authTest.navigations)).toEqual(["/app"]);
    expect(await page.evaluate(() => window.__authTest.counts.updatePassword)).toBe(1);
    await context.close();
    record("password mismatch is local; a valid update is confirmed once before navigation");
  }
  {
    const { page, context } = await open("mode=in");
    await page.getByRole("button", { name: /Google/ }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => page.evaluate(() => window.__authTest.counts.google ?? 0)).toBe(1);
    await expect(page.getByRole("button", { name: /Google/ })).toBeDisabled();
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    await context.close();
    record("OAuth attempt cannot be duplicated while waiting for redirect");
  }
  for (const lang of ["en", "lt"])
    for (const screen of ["mode=up", "screen=reset"]) {
      const { page, context } = await open(screen + "&lang=" + lang, 320);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      await page.screenshot({
        path: path.join(output, `${screen.replace("=", "-")}-${lang}-320.png`),
        fullPage: true,
      });
      await context.close();
      record(`${screen}: ${lang} 320px view has no horizontal overflow`);
    }
  expect(errors).toEqual([]);
} finally {
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real auth routes and AuthProvider with synthetic Supabase responses; no real email, OAuth provider or account actions",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  await browser?.close();
  await server.close();
}
