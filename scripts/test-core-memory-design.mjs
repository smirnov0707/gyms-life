import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyMemoryDesign({ open, record, artifacts }) {
  const captures = [];
  const panel = (page) => page.locator(".fl-twin-memory");
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
      console.log("MEMORY_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("MEMORY_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("MEMORY_UI_END " + name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=memory&shell=1&route=/twin&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(panel(page).locator(".fl-memory-pattern")).toHaveCount(2);
        await expect(panel(page).locator(".fl-memory-overview dd")).toHaveText(["2", "1"]);
        await expect(panel(page).locator('[data-eligible="true"]')).toHaveCount(1);
        await expect(panel(page).locator(".fl-memory-change-grid article")).toHaveCount(2);
        const summaries = panel(page).locator("details > summary");
        for (let i = 0; i < 2; i++) await summaries.nth(i).press("Enter");
        await expect(panel(page).locator("details[open]")).toHaveCount(2);
        await expect(panel(page)).toContainText(lang === "lt" ? "0,63 santykis" : "0.63 ratio");
        await expect(panel(page)).toContainText(lang === "lt" ? "7 trenir." : "7 workouts");
        await expect(panel(page)).not.toContainText(
          /rated_sessions|deterministic|00000000|user_reported/,
        );
        const reads = await page.evaluate(() => ({
          args: window.__core.last.getLabOverview,
          owner: window.__core.profile.id,
          key: window.__coreQueries
            .getQueryCache()
            .getAll()
            .find((q) => q.queryKey[0] === "future-lab-overview")?.queryKey,
        }));
        expect(reads.key).toEqual(["future-lab-overview", reads.owner, "Europe/Vilnius"]);
        expect(reads.args).toEqual({ timeZone: "Europe/Vilnius" });
        expect(
          await panel(page)
            .locator("h2")
            .evaluate((el) => getComputedStyle(el).fontFamily),
        ).toContain("Space Grotesk");
        await capture(page, `memory-${lang}-${theme}-${width}`, "ready");
        await context.close();
        record(
          `memory ${lang} ${theme} ${width}: real evaluators, eligibility, localized evidence, keyboard disclosure and owner/timezone query`,
        );
      }
  for (const scenario of [
    "drift",
    "definition",
    "broken",
    "unanchored",
    "insufficient",
    "unknown",
  ]) {
    const { page, context } = await open(`screen=memory&scenario=${scenario}&shell=1&theme=light`, {
      width: 320,
      height: 900,
    });
    await expect(panel(page).locator(".fl-memory-pattern").first()).toBeVisible();
    await expect(panel(page).locator('[data-eligible="true"]')).toHaveCount(0);
    await panel(page).locator("details > summary").first().press("Enter");
    if (["drift", "definition", "broken"].includes(scenario))
      await expect(panel(page).locator('[data-warning="true"]')).toHaveCount(1);
    if (scenario === "broken")
      await expect(panel(page)).toContainText("reversed direction 1 time(s)");
    if (scenario === "unanchored")
      await expect(panel(page)).toContainText("There is no earlier saved observation");
    if (scenario === "insufficient") {
      await expect(panel(page)).toContainText("2 more observation(s)");
      await expect(panel(page).getByRole("link", { name: /Add evidence/ })).toHaveAttribute(
        "href",
        /route=%2Fapp/,
      );
    }
    if (scenario === "unknown") {
      await expect(panel(page)).toContainText("Value format unavailable");
      await expect(panel(page)).not.toContainText("UNTRUSTED_");
    }
    await noOverflow(page);
    if (["broken", "insufficient"].includes(scenario))
      await capture(page, `memory-${scenario}-en-light-320`, scenario);
    await context.close();
    record(
      `memory ${scenario}: withheld authority and honest history/observation explanation at 320px`,
    );
  }
  for (const scenario of ["empty", "gap"]) {
    const { page, context } = await open(
      `screen=memory&scenario=${scenario}&shell=1&lang=lt&theme=light`,
      { width: 390, height: 900 },
    );
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
    await expect(panel(page).locator(".fl-memory-overview")).toHaveCount(0);
    await expect(panel(page).locator(".fl-memory-next")).toHaveCount(scenario === "gap" ? 1 : 0);
    if (scenario === "gap") {
      await expect(panel(page).getByRole("link", { name: /Pridėti įrodymą/ })).toHaveAttribute(
        "href",
        /route=%2Freadiness/,
      );
      await page.evaluate(() => {
        window.__core.fail = "memory";
        return window.__coreQueries.refetchQueries({ queryKey: ["future-lab-overview"] });
      });
      await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
      await expect(panel(page).locator(".fl-memory-next")).toHaveCount(0);
    } else await capture(page, "memory-empty-lt-light-390", "empty");
    await context.close();
    record(
      `memory ${scenario}: empty read distinct from failure; failed refresh hides cached gap action`,
    );
  }
  {
    const { page, context } = await open("screen=memory&fail=memory&shell=1&lang=lt", {
      width: 390,
      height: 900,
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(panel(page)).not.toContainText("UNTRUSTED_");
    await capture(page, "memory-error-lt-dark-390", "error");
    await page.evaluate(() => {
      window.__core.fail = "memory-pending";
    });
    await panel(page)
      .getByRole("button", { name: "Bandyti dar kartą", exact: true })
      .press("Enter");
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(panel(page).locator("button,.fl-memory-pattern,.fl-memory-next")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(panel(page).locator(".fl-memory-pattern")).toHaveCount(2);
    await page.evaluate(() => {
      window.__core.fail = "memory";
      return window.__coreQueries.refetchQueries({ queryKey: ["future-lab-overview"] });
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(
      panel(page).locator(
        ".fl-memory-overview,.fl-memory-pattern,.fl-memory-changes,.fl-memory-next",
      ),
    ).toHaveCount(0);
    await context.close();
    record(
      "memory errors: safe initial failure, keyboard retry, pending and stale-data withdrawal",
    );
  }
  for (const lang of ["ru", "uk", "pl", "de", "es", "fr"]) {
    const { page, context } = await open(`screen=memory&lang=${lang}&theme=light&shell=1`, {
      width: 320,
      height: 900,
    });
    await expect(panel(page).locator(".fl-memory-pattern")).toHaveCount(2);
    await expect(panel(page).locator("h2")).toHaveText("Learning your rhythm.");
    await noOverflow(page);
    await context.close();
    record(`memory ${lang}: established English fallback and 320px layout`);
  }
  await writeFile(
    path.join(artifacts, "memory-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
