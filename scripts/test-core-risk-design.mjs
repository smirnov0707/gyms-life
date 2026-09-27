import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyRiskDesign({ open, record, artifacts }) {
  const captures = [];
  const panel = (page) => page.locator(".fl-risk-review");
  const noOverflow = async (page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  const capture = async (page, name, scenario) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.activeElement?.blur();
      window.scrollTo(0, 0);
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
      console.log("RISK_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("RISK_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("RISK_UI_END " + name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=risk&route=/twin&shell=1&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
        await expect(page.locator(".fl-risk-factors article")).toHaveCount(5);
        await expect(page.locator(".fl-risk-coverage dd")).toHaveText("5/5");
        await expect(page.locator('[data-factor="nx.risk.acwr"] strong')).toHaveText("6.00×");
        await expect(page.locator(".fl-risk-gaps")).toHaveCount(0);
        const reads = await page.evaluate(() => ({
          last: window.__core.last,
          owner: window.__core.profile.id,
          key: window.__coreQueries
            .getQueryCache()
            .getAll()
            .find((q) => q.queryKey[0] === "injury-risk")?.queryKey,
        }));
        expect(reads.key).toEqual(["injury-risk", reads.owner]);
        for (const table of ["set_logs", "workout_sessions", "daily_checkins"])
          expect(reads.last["riskRead:" + table].filters).toEqual({ user_id: reads.owner });
        expect(reads.last["riskRead:set_logs"].lowerBounds.performed_at).toBeTruthy();
        expect(reads.last["riskRead:workout_sessions"].lowerBounds.started_at).toBeTruthy();
        expect(reads.last["riskRead:daily_checkins"].limit).toBe(14);
        await expect(panel(page)).not.toContainText("EXCLUDED_");
        const method = page.locator(".fl-risk-method");
        await method.locator("summary").press("Enter");
        await expect(method).toHaveAttribute("open", "");
        await expect(method).toContainText(
          lang === "lt" ? "Tai nėra traumos tikimybės procentas" : "not a percentage probability",
        );
        await expect(method).toContainText("30–54");
        await expect(method).toContainText("55–100");
        await method.locator("summary").press("Enter");
        const styles = await panel(page).evaluate((el) => ({
          font: getComputedStyle(el.querySelector("h2")).fontFamily,
          main: getComputedStyle(el.querySelector(".fl-risk-factor-value strong")).fontFamily,
        }));
        expect(styles.font).toContain("Space Grotesk");
        expect(styles.main).toContain("Space Grotesk");
        await capture(page, `risk-${lang}-${theme}-${width}`, "ready");
        await context.close();
        record(
          `risk ${lang} ${theme} ${width}: real model, owner-scoped reads, keyboard explanation and visual capture`,
        );
      }
  for (const [scenario, factors, score] of [
    ["low", 4, "0/100"],
    ["partial", 1, "0/100"],
    ["empty", 0, null],
    ["unmeasured", 0, null],
  ]) {
    const { page, context } = await open(
      `screen=risk&scenario=${scenario}&lang=lt&theme=light&shell=1`,
      { width: 320, height: 900 },
    );
    await expect(page.locator(".fl-risk-factors article")).toHaveCount(factors);
    if (score !== null) {
      await expect(panel(page).getByTestId("risk-score")).toHaveText(score);
      await expect(page.locator(".fl-risk-coverage dd")).toHaveText(`${factors}/5`);
      await expect(page.locator(".fl-risk-gaps li")).toHaveCount(5 - factors);
    } else {
      await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
      await expect(panel(page).getByTestId("risk-score")).toHaveCount(0);
      await expect(page.locator(".fl-risk-level")).toHaveCount(0);
    }
    if (["partial", "unmeasured"].includes(scenario))
      await capture(page, `risk-${scenario}-lt-light-320`, scenario);
    await noOverflow(page);
    await context.close();
    record(`risk ${scenario}: zero remains measured and unavailable factors never imply safety`);
  }
  {
    const { page, context } = await open("screen=risk&fail=risk-pending");
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(panel(page).getByTestId("risk-score")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
    await context.close();
    record("risk pending read hides the report and resolves to measured signals");
  }
  for (const table of ["set_logs", "workout_sessions", "daily_checkins"]) {
    const { page, context } = await open(`screen=risk&fail=risk-${table}&shell=1&theme=light`, {
      width: 390,
      height: 900,
    });
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(panel(page).getByTestId("risk-score")).toHaveCount(0);
    await expect(panel(page)).not.toContainText("UNTRUSTED_");
    if (table === "set_logs") await capture(page, "risk-error-en-light-390", "error");
    await page.evaluate(() => {
      window.__core.fail = "risk-pending";
    });
    await panel(page).getByRole("button", { name: "Try again", exact: true }).press("Enter");
    // With no cached data, React Query returns to pending during retry.
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "loading");
    await expect(panel(page).getByRole("button")).toHaveCount(0);
    await expect(panel(page).getByTestId("risk-score")).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
    await context.close();
    record(`risk ${table} read failure stays safe and keyboard retry restores the report`);
  }
  {
    const { page, context } = await open("screen=risk");
    await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
    await page.evaluate(() => {
      window.__core.fail = "risk";
      return window.__coreQueries.refetchQueries({ queryKey: ["injury-risk"] });
    });
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(page.locator(".fl-risk-overview,.fl-risk-factors,.fl-risk-gaps")).toHaveCount(0);
    await context.close();
    record("risk failed refresh hides the stale score, factors and coverage");
  }
  for (const lang of ["ru", "uk", "pl", "de", "es", "fr"]) {
    const { page, context } = await open(`screen=risk&lang=${lang}&theme=light&shell=1`, {
      width: 320,
      height: 900,
    });
    await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
    await expect(page.locator(".fl-risk-summary h3")).toHaveText("Signals in your training");
    await expect(panel(page)).not.toContainText("Tavo treniruočių signalai");
    await noOverflow(page);
    await context.close();
    record(
      `risk ${lang}: translated source labels and established English helper fallback fit 320px`,
    );
  }
  for (const theme of ["dark", "light"])
    for (const width of [1440, 390]) {
      const { page, context } = await open(
        `screen=future&risk=ready&route=/twin&shell=1&lang=lt&theme=${theme}`,
        { width, height: 900 },
      );
      await page
        .locator(".twin-future-view > details")
        .nth(1)
        .locator(":scope > summary")
        .press("Enter");
      await expect(panel(page).getByTestId("risk-score")).toHaveText("57/100");
      await expect(page.locator(".fl-weekly-review")).toBeVisible();
      await expect(page.locator(".fl-performance-metrics")).toBeVisible();
      await capture(page, `risk-future-lt-${theme}-${width}`, "composition");
      await page.evaluate(() => {
        window.__core.fail = "risk";
        return window.__coreQueries.refetchQueries({ queryKey: ["injury-risk"] });
      });
      await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
      await expect(page.locator(".fl-weekly-metrics")).toBeVisible();
      await expect(page.locator(".fl-performance-metrics")).toBeVisible();
      await context.close();
      record(`risk Future ${theme} ${width}: populated composition and independent read failure`);
    }
  await writeFile(
    path.join(artifacts, "risk-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
