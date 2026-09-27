import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function verifyObservedDesign({ open, record, artifacts }) {
  const captures = [];
  const metric = (page, key) => page.locator(`[data-metric="${key}"]`);
  const panel = (page) => page.locator(".fl-observed-page");
  const noOverflow = async (page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  const capture = async (page, meta) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.fonts.ready);
    // Capture the resting design after keyboard behavior has been exercised.
    await page.evaluate(() => document.activeElement?.blur());
    await noOverflow(page);
    const png = await page.screenshot({
      path: path.join(artifacts, meta.name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
    const row = {
      ...meta,
      bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"),
    };
    captures.push(row);
    if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
      console.log("OBSERVED_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("OBSERVED_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("OBSERVED_UI_END " + meta.name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=observed&route=/twin&shell=1&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(metric(page, "sleepHours").locator(".fl-observed-value")).toHaveText(
          lang === "lt" ? "7,5h" : "7.5h",
        );
        await expect(metric(page, "weightKg").locator(".fl-observed-value")).toHaveText("—");
        await expect(metric(page, "readiness").locator(".fl-observed-change")).toContainText("+3");
        await expect(page.locator(".fl-observed-line")).toHaveCount(3);
        await expect(page.locator(".fl-observed-coverage")).toContainText(
          lang === "lt" ? "Neįtraukti įrašai: 3" : "Excluded records: 3",
        );
        await expect(page.locator(".fl-observed-coverage")).toContainText(
          lang === "lt" ? "Yra senesnių įrašų" : "Older records exist",
        );
        await capture(page, {
          name: `observed-${lang}-${theme}-${width}`,
          lang,
          theme,
          width,
          scenario: "ready",
        });
        await context.close();
        record(
          `observed ${lang} ${theme} ${width}: localized latest observations, honest coverage and responsive capture`,
        );
      }
  {
    const { page, context } = await open("screen=observed&theme=light&lang=lt", {
      width: 320,
      height: 900,
    });
    const values = metric(page, "readiness").locator(".fl-observed-values");
    await values.locator("summary").press("Enter");
    await expect(values.locator("tbody tr")).toHaveCount(4);
    await expect(values.locator("tbody tr").first()).toContainText("62");
    await expect(values.locator("tbody tr").last()).toContainText("65");
    for (const [name, count] of [
      ["90 d.", 5],
      ["180 d.", 6],
      ["Visi įkelti", 6],
      ["30 d.", 4],
    ]) {
      await page.getByRole("button", { name, exact: true }).press("Enter");
      await expect(values.locator("tbody tr")).toHaveCount(count);
      await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expect(values.locator("table")).toBeVisible();
    await noOverflow(page);
    const scope = await page.evaluate(
      () =>
        window.__coreQueries
          .getQueryCache()
          .getAll()
          .find((q) => q.queryKey[0] === "future-me-trend")?.queryKey,
    );
    expect(scope).toEqual(["future-me-trend", await page.evaluate(() => window.__core.profile.id)]);
    await context.close();
    record(
      "observed keyboard periods filter exact chronological values and retain owner scope at 320px",
    );
  }
  for (const scenario of ["empty", "single", "short-span"]) {
    const { page, context } = await open(`screen=observed&scenario=${scenario}`);
    await expect(page.locator(".fl-observed-metric")).toHaveCount(4);
    await expect(page.locator(".fl-observed-line")).toHaveCount(0);
    if (scenario === "empty") {
      await expect(page.locator(".fl-observed-value")).toHaveText(["—", "—", "—", "—"]);
      await expect(page.locator(".fl-observed-values")).toHaveCount(0);
    } else {
      await expect(metric(page, "readiness").locator(".fl-observed-change")).toContainText(
        "More observations over time",
      );
      await expect(metric(page, "totalVolumeLast28Days").locator(".fl-observed-value")).toHaveText(
        scenario === "single" ? "0kg" : "3,750kg",
      );
    }
    await context.close();
    record(`observed ${scenario} does not fabricate a direction or missing measurement`);
  }
  for (const pending of [true, false]) {
    const { page, context } = await open(
      `screen=observed&fail=${pending ? "observed-pending" : "observed"}`,
    );
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute(
      "data-state",
      pending ? "loading" : "error",
    );
    await expect(page.locator(".fl-observed-metric")).toHaveCount(0);
    await expect(panel(page)).not.toContainText("UNTRUSTED_SYNTHETIC_OBSERVED_FAILURE");
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    if (!pending) await panel(page).getByRole("button", { name: "Try again" }).press("Enter");
    await expect(page.locator(".fl-observed-metric")).toHaveCount(4);
    await context.close();
    record(
      `observed ${pending ? "pending" : "failure"} is distinct and recovers without invented records`,
    );
  }
  {
    const { page, context } = await open("screen=observed");
    await expect(page.locator(".fl-observed-metric")).toHaveCount(4);
    await page.evaluate(async () => {
      window.__core.fail = "observed";
      await window.__coreQueries.refetchQueries({ queryKey: ["future-me-trend"] });
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(page.locator(".fl-observed-metric")).toHaveCount(0);
    await context.close();
    record("observed failed refresh hides cached measurements and directions");
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(`screen=observed&lang=${lang}`, {
      width: 320,
      height: 900,
    });
    await expect(page.getByRole("heading", { name: "Your observed evolution" })).toBeVisible();
    await expect(metric(page, "weightKg")).toContainText("No compatible observations");
    await noOverflow(page);
    await context.close();
    record(`observed ${lang} uses the established English fallback at 320px`);
  }
  for (const theme of ["dark", "light"])
    for (const width of [1440, 390]) {
      const { page, context } = await open(
        `screen=future&route=/twin&shell=1&lang=lt&theme=${theme}&scenario=reference`,
        { width, height: 900 },
      );
      const disclosures = page.locator(".twin-future-view > details");
      await expect(disclosures).toHaveCount(2);
      const projection = page.locator(".fl-strength-summary");
      await expect(projection).toContainText("94,4 kg");
      await expect(projection).toContainText("+2,6%");
      const contrastSamples = await projection.evaluate((el) => {
        const root = getComputedStyle(document.documentElement);
        const rgba = (value) => {
          const c = document.createElement("canvas").getContext("2d");
          c.fillStyle = value;
          c.fillRect(0, 0, 1, 1);
          return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v / 255);
        };
        const lum = (rgb) =>
          rgb
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
        const contrast = (a, b) =>
          (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const surface = rgba(root.getPropertyValue("--surface")),
          primary = rgba(root.getPropertyValue("--primary"));
        const tint = surface.map((v, i) => v * 0.92 + primary[i] * 0.08);
        return [...el.querySelectorAll("dd")]
          .filter((n) => n.getClientRects().length)
          .map((n) => {
            const color = rgba(getComputedStyle(n).color);
            return {
              text: n.textContent,
              ratio: Math.min(contrast(color, surface), contrast(color, tint)),
            };
          });
      });
      expect(contrastSamples.length).toBeGreaterThanOrEqual(3);
      for (const sample of contrastSamples)
        expect(sample.ratio, `${theme}: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
      await disclosures.nth(0).locator(":scope > summary").press("Enter");
      await expect(panel(page)).toBeVisible();
      await expect(page.locator(".fl-observed-metric")).toHaveCount(4);
      await capture(page, {
        name: `future-lt-${theme}-${width}`,
        lang: "lt",
        theme,
        width,
        scenario: "observed-expanded",
      });
      await disclosures.nth(0).locator(":scope > summary").press("Enter");
      await disclosures.nth(1).locator(":scope > summary").press("Enter");
      await expect(page.locator(".fl-weekly-review")).toBeVisible();
      await expect(page.locator(".fl-weekly-metrics dd")).toHaveText(["3", "4", "52,5/100"]);
      await expect(page.locator(".fl-weekly-discoveries article").nth(1)).toContainText("52,5/100");
      await expect(page.locator(".fl-weekly-discoveries footer").nth(1)).toContainText(
        "pasiruošimo patikrų",
      );
      await noOverflow(page);
      await capture(page, {
        name: `evidence-lt-${theme}-${width}`,
        lang: "lt",
        theme,
        width,
        scenario: "evidence-expanded",
      });
      await page.evaluate(() => {
        window.__core.fail = "weekly";
        return window.__coreQueries.refetchQueries({ queryKey: ["weekly-intelligence-review"] });
      });
      await expect(page.locator(".fl-weekly-review .fl-ledger-state")).toHaveAttribute(
        "data-state",
        "error",
      );
      await expect(page.locator(".fl-performance-metrics")).toBeVisible();
      await context.close();
      record(
        `future composition ${theme} ${width}: keyboard disclosures, localized weekly evidence and independent failure`,
      );
    }
  await writeFile(
    path.join(artifacts, "observed-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
