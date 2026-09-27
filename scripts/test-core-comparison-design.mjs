import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function verifyComparisonDesign({ open, record, artifacts }) {
  const captures = [];
  const map = (page) => page.locator(".fl-change-map");
  const bridge = (page) => page.locator(".fl-evidence-bridge");
  const metric = (page, kind) => map(page).locator(`[data-metric=${kind}]`);
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
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
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
      console.log("COMPARISON_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("COMPARISON_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("COMPARISON_UI_END " + name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=comparison&shell=1&route=/twin&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        const select = map(page).getByRole("combobox");
        await expect(select).toHaveValue("chest");
        await expect(metric(page, "recovery").locator("dd")).toHaveText([
          "40 %",
          "64 %",
          lang === "lt" ? "+24 proc. p." : "+24 pp",
        ]);
        await expect(metric(page, "volume").locator("dd")).toHaveText([
          "0 kg",
          "520 kg",
          "+520 kg",
        ]);
        await expect(map(page).locator(".fl-change-selection span")).toHaveAttribute(
          "data-tone",
          "cool",
        );
        await expect(map(page).locator(".fl-change-legend li")).toHaveCount(4);
        await select.selectOption("shoulders");
        await expect(map(page).locator(".fl-change-selection span")).toHaveAttribute(
          "data-tone",
          "hot",
        );
        await expect(metric(page, "recovery").locator(".fl-change-difference dd")).toHaveText(
          lang === "lt" ? "−27 proc. p." : "-27 pp",
        );
        await select.selectOption("glutes");
        await expect(
          map(page).getByRole("button", { name: lang === "lt" ? "Nugara" : "Back", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(map(page).locator(".fl-change-selection span")).toHaveAttribute(
          "data-tone",
          "neutral",
        );
        await expect(metric(page, "recovery").locator(".fl-change-difference dd")).toHaveText(
          lang === "lt" ? "0 proc. p." : "0 pp",
        );
        await expect(
          map(page).locator("g[role=button][aria-pressed=true] > g > path"),
        ).toHaveAttribute("fill", /-neutral\)$/);
        await select.selectOption("legs");
        await expect(metric(page, "recovery").locator("dd")).toHaveText(["—", "—", "—"]);
        await expect(map(page).locator(".fl-change-selection span")).toHaveAttribute(
          "data-tone",
          "muted",
        );
        await select.selectOption("cardio");
        await expect(metric(page, "volume").locator("dd")).toHaveText(["0 kg", "0 kg", "0 kg"]);
        await expect(map(page).locator("g[role=button][aria-pressed=true]")).toHaveCount(0);
        await map(page)
          .getByRole("button", { name: lang === "lt" ? "Priekis" : "Front", exact: true })
          .press("Enter");
        const chest = await select.locator("option[value=chest]").textContent();
        // Exercise the SVG region's existing native keyboard handler as well as the selector.
        await map(page).getByRole("button", { name: chest, exact: true }).press("Enter");
        await expect(select).toHaveValue("chest");
        await expect(map(page).locator(".fl-comparison-dates time").first()).toContainText("27");
        await expect(map(page).locator(".fl-comparison-dates time").first()).toContainText("00:30");
        expect(await page.evaluate(() => window.__core.counts.getTwinEvidenceWindow ?? 0)).toBe(0);
        await bridge(page).locator(".fl-evidence-toggle").press("Enter");
        await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(4);
        await expect(bridge(page).locator(".fl-evidence-counts dd")).toHaveText([
          "1",
          "1",
          "1",
          "1",
        ]);
        await expect(bridge(page).locator(".fl-evidence-coverage")).toContainText("3");
        const first = bridge(page).locator(".fl-evidence-event").first();
        await expect(first.locator(".fl-evidence-time time")).toHaveAttribute(
          "datetime",
          "2026-09-27T21:30:00.000Z",
        );
        await expect(first.locator(".fl-evidence-time time")).toContainText("00:30");
        await expect(
          bridge(page).locator("[data-event=checkin_recorded] .fl-evidence-time time"),
        ).toContainText("14:29");
        await expect(bridge(page).locator("[data-event=unknown]")).toContainText("UTC");
        await expect(bridge(page)).not.toContainText("unknown-kind");
        await expect(bridge(page)).not.toContainText("unknown-origin");
        await first.locator("summary").press("Enter");
        await expect(first.locator("dl")).toContainText("Europe/Vilnius");
        await expect(first.locator("dl time")).toHaveAttribute(
          "datetime",
          "2026-09-27T21:31:00.000Z",
        );
        await first.locator("summary").press("Enter");
        const scope = await page.evaluate(() => ({
          owner: window.__core.profile.id,
          key: window.__coreQueries
            .getQueryCache()
            .getAll()
            .find((q) => q.queryKey[0] === "twin-evidence-window")?.queryKey,
        }));
        expect(scope.key).toEqual([
          "twin-evidence-window",
          scope.owner,
          "00000000-0000-4000-8000-000000000100",
          "00000000-0000-4000-8000-000000000101",
          "2026-09-26T21:30:00.000Z",
          "2026-09-27T21:30:00.000Z",
        ]);
        await capture(page, `comparison-${lang}-${theme}-${width}`, "ready");
        await context.close();
        record(
          `comparison ${lang} ${theme} ${width}: real projections, four distinct tones, before/after values, keyboard muscle views, interval boundaries, local times and source provenance`,
        );
      }
  for (const scenario of [
    "empty",
    "excluded",
    "bounded",
    "equal",
    "reversed",
    "unknown",
    "incompatible",
  ]) {
    const { page, context } = await open(
      `screen=comparison&shell=1&route=/twin&lang=lt&theme=light&scenario=${scenario}`,
      { width: 320, height: 900 },
    );
    if (scenario === "unknown") {
      await expect(map(page).getByRole("combobox")).toHaveValue("");
      await map(page).getByRole("combobox").selectOption("chest");
      await expect(metric(page, "recovery").locator("dd")).toHaveText(["—", "—", "—"]);
      await expect(map(page).locator(".fl-change-selection span")).toHaveAttribute(
        "data-tone",
        "muted",
      );
      await capture(page, "comparison-unknown-lt-light-320", scenario);
    } else if (scenario === "incompatible") {
      await expect(map(page)).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Šių būsenų palyginti negalima.", exact: true }),
      ).toBeVisible();
    } else {
      await bridge(page).locator(".fl-evidence-toggle").press("Enter");
      if (scenario === "bounded") {
        await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(30);
        await expect(bridge(page).locator(".fl-evidence-counts dd")).toHaveText("30");
        await expect(bridge(page)).toContainText("Rodoma tik dalis intervalo įrašų.");
      } else {
        await expect(bridge(page).locator(".fl-ledger-state")).toHaveAttribute(
          "data-state",
          "empty",
        );
        await expect(bridge(page).locator(".fl-evidence-event,.fl-evidence-counts")).toHaveCount(0);
        if (scenario === "equal" || scenario === "reversed") {
          expect(await page.evaluate(() => window.__core.counts.getTwinEvidenceWindow ?? 0)).toBe(
            0,
          );
          await expect(bridge(page)).toContainText("Šiam palyginimui laiko intervalo nėra.");
        } else if (scenario === "excluded") {
          await expect(bridge(page)).toContainText("Nė vieno įrašo nepavyko patvirtinti.");
          await expect(bridge(page)).toContainText(
            "Nepatikrinti arba intervalui nepriskirti įrašai: 3",
          );
          await capture(page, "comparison-excluded-lt-light-320", scenario);
        } else await expect(bridge(page)).toContainText("Šiame intervale įrašų nerasta.");
      }
    }
    await noOverflow(page);
    await context.close();
    record(
      `comparison ${scenario}: unavailable data stays distinct from zero and interval reads remain bounded`,
    );
  }
  {
    const { page, context } = await open(
      "screen=comparison&shell=1&route=/twin&lang=lt&fail=evidence",
      { width: 390, height: 900 },
    );
    await bridge(page).locator(".fl-evidence-toggle").press("Enter");
    await expect(bridge(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(bridge(page)).not.toContainText("UNTRUSTED_");
    await capture(page, "comparison-error-lt-dark-390", "error");
    await page.evaluate(() => {
      window.__core.fail = "evidence-pending";
    });
    await bridge(page)
      .getByRole("button", { name: "Bandyti dar kartą", exact: true })
      .press("Enter");
    await expect(bridge(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(4);
    await page.evaluate(() => {
      window.__core.fail = "evidence";
      return window.__coreQueries.refetchQueries({ queryKey: ["twin-evidence-window"] });
    });
    await expect(bridge(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(
      bridge(page).locator(".fl-evidence-events,.fl-evidence-counts,.fl-evidence-coverage"),
    ).toHaveCount(0);
    await expect(metric(page, "recovery").locator(".fl-change-difference dd")).toHaveText(
      "+24 proc. p.",
    );
    await context.close();
    record(
      "comparison interval failure, safe keyboard retry, pending state and failed-refresh withdrawal preserve the independent saved-state comparison",
    );
  }
  {
    const { page, context } = await open("screen=comparison&shell=1&route=/twin&switch=1");
    await bridge(page).locator(".fl-evidence-toggle").press("Enter");
    await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(4);
    await map(page).getByRole("combobox").selectOption("glutes");
    await page.evaluate(() => {
      window.__core.fail = "evidence-pending";
    });
    await page.getByRole("button", { name: "Switch saved pair", exact: true }).press("Enter");
    await expect(map(page).getByRole("combobox")).toHaveValue("chest");
    await expect(bridge(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(bridge(page).locator(".fl-evidence-event")).toHaveCount(4);
    expect(await page.evaluate(() => window.__core.last.getTwinEvidenceWindow)).toEqual({
      olderAt: "2026-09-24T21:30:00.000Z",
      newerAt: "2026-09-25T21:30:00.000Z",
    });
    await expect(bridge(page).locator(".fl-evidence-time time").first()).toHaveAttribute(
      "datetime",
      "2026-09-25T21:30:00.000Z",
    );
    await context.close();
    record(
      "comparison switching the saved pair resets region selection and never borrows the previous interval events",
    );
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(
      `screen=comparison&shell=1&route=/twin&lang=${lang}&theme=light`,
      { width: 320, height: 900 },
    );
    await expect(map(page).getByRole("heading", { level: 3 })).toHaveText("Muscle change map");
    await bridge(page).locator(".fl-evidence-toggle").press("Enter");
    await expect(bridge(page).locator(".fl-evidence-event").first()).toContainText(
      "Workout completed",
    );
    await noOverflow(page);
    await context.close();
    record(`comparison ${lang}: English copy fallback with localized muscle labels at 320px`);
  }
  await writeFile(
    path.join(artifacts, "comparison-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
