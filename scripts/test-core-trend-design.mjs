import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyTrendDesign({ open, record, artifacts }) {
  const captures = [];
  const panel = (page) => page.locator(".fl-trend-lens");
  const overall = (page) => panel(page).locator('[data-scope="overall"]');
  const region = (page) => panel(page).locator('[data-scope="region"]');
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
      console.log("TREND_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("TREND_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("TREND_UI_END " + name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=trend&shell=1&route=/twin&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(overall(page).locator(".fl-trend-latest")).toHaveText("72/100");
        await region(page).getByRole("combobox").selectOption("chest");
        await expect(region(page).locator(".fl-trend-latest")).toHaveText("68%");
        await expect(panel(page).getByRole("img")).toHaveCount(2);
        await expect(overall(page).locator(".fl-trend-summary dd").nth(1)).toHaveText(
          lang === "lt" ? "+12 p." : "+12 pt",
        );
        await expect(region(page).locator(".fl-trend-summary dd").nth(1)).toHaveText(
          lang === "lt" ? "−12 proc. p." : "-12 pp",
        );
        for (const area of [overall(page), region(page)]) {
          await area.locator(".fl-trend-values summary").press("Enter");
          await expect(area.getByRole("table")).toBeVisible();
          await expect(area.locator("tbody tr")).toHaveCount(4);
          await expect(area.locator(".fl-trend-values")).toContainText("Europe/Vilnius");
          // UTC 21:30 belongs to the next local date, not the UTC calendar date.
          const firstTime = area.locator("tbody time").first();
          await expect(firstTime).toHaveAttribute("datetime", "2026-09-20T21:30:00.000Z");
          await expect(firstTime).toContainText("21");
          await expect(firstTime).toContainText("00:30");
          await area.locator(".fl-trend-values summary").press("Enter");
        }
        const scope = await page.evaluate(() => ({
          owner: window.__core.profile.id,
          key: window.__coreQueries
            .getQueryCache()
            .getAll()
            .find((q) => q.queryKey[0] === "twin-trend")?.queryKey,
        }));
        expect(scope.key).toEqual(["twin-trend", scope.owner]);
        expect(
          await panel(page)
            .locator("h2 button")
            .evaluate((el) => getComputedStyle(el).fontFamily),
        ).toContain("Space Grotesk");
        if (width === 1440) {
          const tops = await panel(page)
            .locator(".fl-trend-latest")
            .evaluateAll((items) => items.map((el) => el.getBoundingClientRect().top));
          expect(Math.abs(tops[0] - tops[1])).toBeLessThanOrEqual(1);
        }
        await capture(page, `trend-${lang}-${theme}-${width}`, "ready");
        await context.close();
        record(
          `trend ${lang} ${theme} ${width}: real source projection, dated charts, point differences, exact tables, owner scope and theme`,
        );
      }
  {
    const { page, context } = await open("screen=trend&collapsed=1&shell=1&theme=light", {
      width: 320,
      height: 900,
    });
    const toggle = panel(page).locator("h2 button");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => window.__core.counts.getTwinTrendHistory ?? 0)).toBe(0);
    await toggle.press("Enter");
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("72/100");
    const reads = await page.evaluate(() => window.__core.counts.getTwinTrendHistory);
    const select = overall(page).getByRole("combobox");
    await select.focus();
    await expect(select).toBeFocused();
    // Native keyboard selection: first option is the sessions metric.
    await select.press("Home");
    await select.press("Enter");
    await expect(select).toHaveValue("sessionsLast7Days");
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("2");
    await select.selectOption("sleepHours");
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("7.3h");
    await expect(overall(page).getByRole("img")).toHaveCount(0);
    await expect(overall(page)).toContainText("Records without a value for this metric: 1");
    await overall(page).locator(".fl-trend-values summary").press("Enter");
    await expect(overall(page).locator("tbody tr")).toHaveCount(3);
    await select.selectOption("weightKg");
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("—");
    await expect(overall(page).locator(".fl-trend-values")).toHaveCount(0);
    await expect(overall(page)).toContainText("Records without a value for this metric: 4");
    await region(page).getByRole("combobox").selectOption("chest");
    await region(page).getByRole("button", { name: "Logged volume", exact: true }).press("Enter");
    await expect(region(page).locator(".fl-trend-latest")).toHaveText("1,560kg");
    await region(page).locator(".fl-trend-values summary").press("Enter");
    await expect(region(page).locator("tbody tr").first()).toContainText("0 kg");
    await noOverflow(page);
    await capture(page, "trend-values-en-light-320", "values");
    await toggle.press("Enter");
    await expect(overall(page)).toBeHidden();
    await toggle.press("Enter");
    await expect(select).toHaveValue("weightKg");
    expect(await page.evaluate(() => window.__core.counts.getTwinTrendHistory)).toBe(reads);
    await context.close();
    record(
      "trend lazy read, keyboard selection, null metric, partial samples, zero volume and retained collapsed controls at 320px",
    );
  }
  for (const scenario of ["single", "short-span", "flat"]) {
    const { page, context } = await open(
      `screen=trend&scenario=${scenario}&region=chest&lang=lt&shell=1`,
      { width: 390, height: 900 },
    );
    await expect(region(page).locator(".fl-trend-series")).toBeVisible();
    await expect(overall(page)).toHaveCount(0);
    await expect(region(page).getByRole("combobox")).toHaveCount(0);
    await expect(region(page).getByRole("img")).toHaveCount(scenario === "flat" ? 1 : 0);
    if (scenario === "single")
      await expect(region(page).locator(".fl-trend-summary dd").nth(1)).toHaveText("—");
    if (scenario === "short-span")
      await expect(region(page)).toContainText(
        "Stebėjimų pakanka, bet reikia bent 3 parų intervalo",
      );
    await noOverflow(page);
    if (scenario === "single") await capture(page, "trend-single-lt-dark-390", scenario);
    await context.close();
    record(`trend regional ${scenario}: requested muscle and four-point/72-hour chart gate`);
  }
  {
    const { page, context } = await open("screen=trend&scenario=flat");
    await expect(overall(page).locator(".fl-trend-direction")).toContainText(
      "Latest value matches the earliest",
    );
    const positions = await overall(page)
      .locator("circle")
      .evaluateAll((items) => items.map((el) => el.getAttribute("cy")));
    expect(positions).toEqual(["72", "72", "72", "72"]);
    await context.close();
    record("trend equal values draw a flat line without implying improvement");
  }
  {
    const { page, context } = await open("screen=trend&region=unknown_muscle&shell=1&theme=light", {
      width: 320,
      height: 900,
    });
    await expect(region(page)).toContainText("Unknown muscle");
    await expect(region(page).locator(".fl-trend-latest")).toHaveText("—");
    await expect(region(page).getByRole("img")).toHaveCount(0);
    await expect(region(page)).toContainText("Records without a value for this metric: 4");
    await noOverflow(page);
    await context.close();
    record("trend missing requested region never falls back to another muscle");
  }
  for (const scenario of ["empty", "excluded"]) {
    const { page, context } = await open(
      `screen=trend&scenario=${scenario}&shell=1&lang=lt&theme=light`,
      { width: 390, height: 900 },
    );
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
    await expect(panel(page).locator(".fl-trend-panel")).toHaveCount(0);
    if (scenario === "excluded") {
      await expect(panel(page)).toContainText("Nepavyko patikrinti įrašų: 1");
      await expect(panel(page)).toContainText("Neįtraukti kitaip apskaičiuoti įrašai: 1");
      await capture(page, "trend-excluded-lt-light-390", scenario);
    }
    await noOverflow(page);
    await context.close();
    record(`trend ${scenario}: successful empty read preserves excluded-source coverage`);
  }
  {
    const { page, context } = await open("screen=trend&fail=observed&shell=1&lang=lt", {
      width: 390,
      height: 900,
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(panel(page)).not.toContainText("UNTRUSTED_");
    await capture(page, "trend-error-lt-dark-390", "error");
    await page.evaluate(() => {
      window.__core.fail = "observed-pending";
    });
    await panel(page)
      .getByRole("button", { name: "Bandyti dar kartą", exact: true })
      .press("Enter");
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(panel(page).locator(".fl-trend-panel")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("72/100");
    await page.evaluate(() => {
      window.__core.fail = "observed";
      return window.__coreQueries.refetchQueries({ queryKey: ["twin-trend"] });
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(panel(page).locator(".fl-trend-panel,.fl-trend-coverage")).toHaveCount(0);
    await context.close();
    record(
      "trend initial failure, safe keyboard retry, pending state and failed-refresh withdrawal",
    );
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(`screen=trend&lang=${lang}&shell=1&theme=light`, {
      width: 320,
      height: 900,
    });
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(
      "Your rhythm, over time.",
    );
    await expect(overall(page).locator(".fl-trend-latest")).toHaveText("72/100");
    await noOverflow(page);
    await context.close();
    record(`trend ${lang}: established English fallback and 320px layout`);
  }
  await writeFile(
    path.join(artifacts, "trend-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
