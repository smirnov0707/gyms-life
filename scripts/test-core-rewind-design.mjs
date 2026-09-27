import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyRewindDesign({ open, record, artifacts }) {
  const captures = [];
  const panel = (page) => page.locator(".fl-rewind");
  const toggle = (page) => panel(page).locator("h2 button");
  const choices = (page) => panel(page).locator(".fl-rewind-history button");
  const selected = (page) => panel(page).locator(".fl-rewind-selected");
  const noOverflow = async (page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  const capture = async (page, name, scenario) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.activeElement?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await noOverflow(page);
    const png = await page.screenshot({
      path: path.join(artifacts, name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
    const row = {
      name,
      scenario,
      bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"),
    };
    captures.push(row);
    if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
      console.log("REWIND_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("REWIND_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("REWIND_UI_END " + name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=rewind&shell=1&route=/twin&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
        expect(await page.evaluate(() => window.__core.counts.getTwinRewindHistory ?? 0)).toBe(0);
        await toggle(page).press("Enter");
        await expect(choices(page)).toHaveCount(4);
        await expect(selected(page)).toHaveCount(0);
        await expect(choices(page).nth(1)).toBeDisabled();
        await choices(page).first().press("Enter");
        await expect(choices(page).first()).toHaveAttribute("aria-pressed", "true");
        await expect(selected(page).locator("[data-metric=readiness] .fl-rewind-value")).toHaveText(
          "72 /100",
        );
        await expect(selected(page).locator("[data-metric=readiness] strong")).toHaveText(
          lang === "lt" ? "+4 p." : "+4 pt",
        );
        await expect(selected(page).locator("[data-metric=weightKg] .fl-rewind-value")).toHaveText(
          "—",
        );
        await expect(selected(page).locator("[data-metric=weightKg] strong")).toHaveText("—");
        await expect(
          selected(page).locator("[data-metric=sleepHours] .fl-rewind-value"),
        ).toHaveText(lang === "lt" ? "7,3 h" : "7.3 h");
        await expect(selected(page).locator("[data-metric=sleepHours] strong")).toHaveText("0 h");
        await expect(selected(page).locator(".fl-rewind-comparison time")).toHaveAttribute(
          "datetime",
          "2026-09-24T21:30:00.000Z",
        );
        await expect(selected(page).locator("h3 time")).toContainText("27");
        await expect(selected(page).locator("h3 time")).toContainText("00:30");
        await expect(panel(page).locator(".fl-rewind-history-heading strong")).toHaveText("3");
        await expect(panel(page).locator(".fl-rewind-coverage")).toContainText("1");
        expect(await toggle(page).evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
          "Space Grotesk",
        );
        const scope = await page.evaluate(() => ({
          owner: window.__core.profile.id,
          key: window.__coreQueries
            .getQueryCache()
            .getAll()
            .find((q) => q.queryKey[0] === "twin-rewind")?.queryKey,
        }));
        expect(scope.key).toEqual(["twin-rewind", scope.owner]);
        await selected(page).locator(".fl-rewind-source summary").press("Enter");
        await expect(selected(page).locator(".fl-rewind-source")).toContainText("Europe/Vilnius");
        await expect(selected(page).locator(".fl-rewind-source")).toContainText(
          lang === "lt" ? "7,25 h" : "7.25 h",
        );
        await selected(page).locator(".fl-rewind-source summary").press("Enter");
        await capture(page, `rewind-${lang}-${theme}-${width}`, "ready");
        const reads = await page.evaluate(() => window.__core.counts.getTwinRewindHistory);
        await toggle(page).press("Enter");
        await expect(selected(page)).toBeHidden();
        await toggle(page).press("Enter");
        await expect(choices(page).first()).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => window.__core.counts.getTwinRewindHistory)).toBe(reads);
        await choices(page).last().press("Enter");
        await expect(selected(page).locator(".fl-rewind-delta")).toHaveCount(0);
        await expect(selected(page).locator(".fl-rewind-comparison time")).toHaveCount(0);
        await context.close();
        record(
          `rewind ${lang} ${theme} ${width}: lazy owner-scoped history, keyboard dates, compatible predecessor, local midnight, exact readings, nulls and retained selection`,
        );
      }
  for (const scenario of ["empty", "excluded", "single", "bounded"]) {
    const { page, context } = await open(
      `screen=rewind&shell=1&route=/twin&scenario=${scenario}&theme=light&lang=lt`,
      { width: 320, height: 900 },
    );
    await toggle(page).press("Enter");
    if (["empty", "excluded"].includes(scenario)) {
      await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
      await expect(selected(page)).toHaveCount(0);
      if (scenario === "excluded") {
        await expect(choices(page)).toHaveCount(1);
        await expect(choices(page).first()).toBeDisabled();
        await expect(panel(page).locator(".fl-rewind-coverage")).toContainText(
          "Nepavyko patikrinti įrašų: 1",
        );
        await expect(panel(page).locator(".fl-rewind-coverage")).toContainText(
          "Su dabartiniu Twin nesuderinami įrašai: 1",
        );
        await capture(page, "rewind-excluded-lt-light-320", scenario);
      }
    } else {
      await expect(choices(page)).toHaveCount(scenario === "single" ? 1 : 12);
      await choices(page).last().press("Enter");
      await expect(selected(page).locator(".fl-rewind-delta")).toHaveCount(0);
      if (scenario === "bounded") {
        await expect(panel(page).locator(".fl-rewind-coverage")).toContainText("Yra ir senesnių");
        await expect(choices(page).last()).toBeInViewport();
      } else await capture(page, "rewind-single-lt-light-320", scenario);
    }
    await noOverflow(page);
    await context.close();
    record(`rewind ${scenario}: bounded coverage, unknown comparison and 320px keyboard reach`);
  }
  {
    const { page, context } = await open("screen=rewind&shell=1&route=/twin&fail=rewind&lang=lt", {
      width: 390,
      height: 900,
    });
    await toggle(page).press("Enter");
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(panel(page)).not.toContainText("UNTRUSTED_");
    await capture(page, "rewind-error-lt-dark-390", "error");
    await page.evaluate(() => {
      window.__core.fail = "rewind-pending";
    });
    await panel(page)
      .getByRole("button", { name: "Bandyti dar kartą", exact: true })
      .press("Enter");
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(choices(page)).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(choices(page)).toHaveCount(4);
    await choices(page).first().press("Enter");
    // Force the supported 2D fallback for this integration check. Full selected
    // GLB/material rendering stays covered by the separate Twin visual workflow.
    await page.evaluate(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
        return getContext.call(this, kind, ...args);
      };
    });
    await selected(page)
      .locator("summary")
      .filter({ hasText: "Atverti šios būsenos Twin" })
      .press("Enter");
    await expect(selected(page).locator("[data-twin-stage]")).toHaveAttribute(
      "data-twin-stage",
      "2d",
    );
    await expect(selected(page).locator("[data-twin-stage]")).toHaveAttribute(
      "data-twin-appearance",
      "analysis",
    );
    await selected(page)
      .locator("summary")
      .filter({ hasText: "Palyginti raumenų grupes" })
      .press("Enter");
    await expect(
      selected(page).getByRole("heading", { name: "Raumenų pokyčių žemėlapis", exact: true }),
    ).toBeVisible();
    await expect(selected(page)).toContainText("+4 proc. p.");
    await selected(page)
      .getByRole("button", { name: /Įvykiai tarp būsenų/ })
      .press("Enter");
    await expect
      .poll(() => page.evaluate(() => window.__core.counts.getTwinEvidenceWindow ?? 0))
      .toBe(1);
    expect(await page.evaluate(() => window.__core.last.getTwinEvidenceWindow)).toEqual({
      olderAt: "2026-09-24T21:30:00.000Z",
      newerAt: "2026-09-26T21:30:00.000Z",
    });
    await page.evaluate(() => {
      window.__core.fail = "rewind";
      return window.__coreQueries.refetchQueries({ queryKey: ["twin-rewind"] });
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(
      panel(page).locator(
        ".fl-rewind-selected,.fl-rewind-history,.fl-rewind-coverage,[data-twin-stage]",
      ),
    ).toHaveCount(0);
    await expect(panel(page).getByText("Raumenų pokyčių žemėlapis", { exact: true })).toHaveCount(
      0,
    );
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await panel(page)
      .getByRole("button", { name: "Bandyti dar kartą", exact: true })
      .press("Enter");
    await expect(selected(page).locator("[data-metric=readiness] .fl-rewind-value")).toHaveText(
      "72 /100",
    );
    await expect(selected(page).locator("[data-twin-stage]")).toHaveCount(0);
    await context.close();
    record(
      "rewind safe retry and failed refresh withdraw selected metrics, change map, interval evidence and real Twin fallback; successful retry restores selected state",
    );
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(
      `screen=rewind&shell=1&route=/twin&lang=${lang}&theme=light`,
      { width: 320, height: 900 },
    );
    await expect(toggle(page)).toHaveText("Return to your story.");
    await toggle(page).press("Enter");
    await expect(choices(page)).toHaveCount(4);
    await choices(page).first().press("Enter");
    await expect(selected(page).locator("[data-metric=readiness] dt")).toHaveText("Readiness");
    await noOverflow(page);
    await context.close();
    record(`rewind ${lang}: English fallback and readable 320px selection`);
  }
  await writeFile(
    path.join(artifacts, "rewind-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
