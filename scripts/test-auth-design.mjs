import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const submit = (page) => page.locator('button[type="submit"]');
async function credentials(page, signup = false) {
  if (signup) await page.locator("#name").fill("Synthetic User");
  await page.locator("#email").fill("synthetic@example.invalid");
  await page.locator("#password").fill("Synthetic-test-only-123");
}

export async function reviewAuthDesign({ open, record, output, engine }) {
  const captures = [];
  const states = [
    { name: "signin", query: "mode=in" },
    { name: "signup", query: "mode=up" },
    {
      name: "confirmation",
      query: "mode=up",
      action: async (page) => {
        await credentials(page, true);
        await submit(page).press("Enter");
        await expect(page.locator(".fl-auth-card > [role=status]")).toBeVisible();
      },
    },
    { name: "forgot", query: "mode=forgot" },
    {
      name: "sent",
      query: "mode=forgot",
      action: async (page) => {
        await page.locator("#email").fill("synthetic@example.invalid");
        await submit(page).press("Enter");
        await expect(page.locator(".fl-auth-form [role=status]")).toBeVisible();
      },
    },
    { name: "reset", query: "screen=reset&session=yes" },
    { name: "expired", query: "screen=reset" },
  ];
  for (const state of states)
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(`${state.query}&theme=${theme}`, width);
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(page.locator("h1")).toBeVisible();
        const mark = await page.locator(".fl-brand-mark").boundingBox();
        expect(mark.width).toBe(36);
        expect(mark.height).toBe(36);
        if (width === 390 && state.name === "signin") {
          const primary = await submit(page).boundingBox();
          expect(primary.y + primary.height).toBeLessThan(844);
        }
        if (state.action) await state.action(page);
        if (state.name === "reset") await expect(page.locator("#pw")).toBeVisible();
        if (state.name === "expired")
          await expect(page.locator(".fl-auth-card [role=alert]")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () =>
              document.fonts.check('16px "Manrope"') &&
              document.fonts.check('16px "Space Grotesk"'),
          ),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await expect(page.getByRole("link", { name: "GYMS.LIFE Future Lab" })).toHaveAttribute(
          "href",
          "/",
        );
        // Keep captures clear of transient notifications; the persistent inline status is asserted above.
        await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10000 });
        const name = `auth-${state.name}-${theme}-${width}.png`;
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
          console.log("AUTH_UI_BEGIN " + JSON.stringify(capture));
          const encoded = buffer.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("AUTH_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("AUTH_UI_END " + name);
        }
        await context.close();
        record(`auth ${state.name} ${theme} ${width}: real brand, local fonts, no overflow`);
      }
  {
    const { page, context } = await open("mode=in&fail=signIn");
    await credentials(page);
    await page.getByRole("button", { name: "Show password", exact: true }).press("Enter");
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Hide password", exact: true }).press("Space");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
    await submit(page).press("Enter");
    await expect(page.locator("#auth-error")).toBeVisible();
    await expect(submit(page)).toBeEnabled();
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    await page.getByRole("button", { name: /Forgot your password/ }).press("Enter");
    await expect(page.locator("#auth-error")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    await context.close();
    record(
      "keyboard password visibility preserves value, focus and autocomplete; errors clear on mode change",
    );
  }
  for (const failure of ["google", "reset", "update"]) {
    const query =
      failure === "update"
        ? "screen=reset&session=yes"
        : failure === "reset"
          ? "mode=forgot"
          : "mode=in";
    const { page, context } = await open(`${query}&fail=${failure}`);
    if (failure === "google") await page.getByRole("button", { name: /Google/ }).press("Enter");
    else {
      if (failure === "reset") await page.locator("#email").fill("synthetic@example.invalid");
      else {
        await page.locator("#pw").fill("Synthetic-test-only-123");
        await page.locator("#pw2").fill("Synthetic-test-only-123");
      }
      await submit(page).press("Enter");
    }
    await expect(page.locator(".fl-auth-card > [role=alert]")).toBeVisible();
    await expect(submit(page)).toBeEnabled();
    expect(await page.evaluate(() => window.__authTest.navigations)).toEqual([]);
    expect(await page.locator(".fl-auth-form [role=status]").count()).toBe(0);
    if (failure === "update")
      await expect(page.locator("#pw")).toHaveValue("Synthetic-test-only-123");
    await context.close();
    record(`${failure} rejection remains visible, preserves draft and does not claim success`);
  }
  {
    const { page, context } = await open("mode=in&theme=dark");
    await page.getByRole("button", { name: "Light", exact: true }).press("Enter");
    await expect(page.locator("html")).toHaveClass(/light/);
    expect(await page.evaluate(() => localStorage.getItem("forma_theme"))).toBe("light");
    await page.getByRole("button", { name: "LT", exact: true }).press("Enter");
    await expect(page.locator("h1")).toHaveText("Sveikas sugrįžęs");
    expect(await page.evaluate(() => localStorage.getItem("forma_lang"))).toBe("lt");
    await context.close();
    record("account-entry language and theme controls update the page and persist preferences");
  }
  for (const theme of ["dark", "light"]) {
    const { page, context } = await open(`mode=up&theme=${theme}&lang=lt`, 320);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const button of await page
      .locator(".fl-auth-preferences button, .fl-auth-password button")
      .all()) {
      const rect = await button.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
    record(`Lithuanian 320px ${theme} preference and visibility controls retain 44px targets`);
  }
  await writeFile(
    path.join(output, "auth-design-review.json"),
    JSON.stringify({ captures }, null, 2) + "\n",
  );
}
