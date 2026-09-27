import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function verifyWeeklyDesign({ open, record, artifacts }) {
  const captures = [];
  const panel = (page) => page.locator(".fl-weekly-review");
  const noOverflow = async (page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  const capture = async (page, meta) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.fonts.ready);
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
      console.log("WEEKLY_UI_BEGIN " + JSON.stringify(row));
      const b = png.toString("base64");
      for (let i = 0; i < b.length; i += 16000)
        console.log("WEEKLY_UI_CHUNK " + b.slice(i, i + 16000));
      console.log("WEEKLY_UI_END " + meta.name);
    }
  };
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=weekly&route=/twin&shell=1&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await expect(page.locator(".fl-weekly-metrics dd")).toHaveText([
          "3",
          "4",
          lang === "lt" ? "52,5/100" : "52.5/100",
        ]);
        await expect(page.locator(".fl-weekly-discoveries article")).toHaveCount(3);
        await expect(panel(page)).not.toContainText("UNTRUSTED_SYNTHETIC_SOURCE_TEXT");
        await expect(page.locator(".fl-weekly-period")).toContainText(
          lang === "lt" ? "Pastarosios 7 dienos" : "Last 7 days",
        );
        await expect(page.locator(".fl-weekly-discoveries footer").first()).toContainText("12");
        expect(await page.evaluate(() => window.__core.last.weeklyTimeZone)).toBe("Europe/Vilnius");
        const key = await page.evaluate(
          () =>
            window.__coreQueries
              .getQueryCache()
              .getAll()
              .find((q) => q.queryKey[0] === "weekly-intelligence-review")?.queryKey,
        );
        expect(key).toEqual([
          "weekly-intelligence-review",
          await page.evaluate(() => window.__core.profile.id),
          "Europe/Vilnius",
        ]);
        await capture(page, {
          name: `weekly-${lang}-${theme}-${width}`,
          lang,
          theme,
          width,
          scenario: "ready",
        });
        await context.close();
        record(
          `weekly ${lang} ${theme} ${width}: app-owned evidence, owner/timezone scope and responsive capture`,
        );
      }
  for (const pending of [true, false]) {
    const { page, context } = await open(
      `screen=weekly&fail=${pending ? "weekly-pending" : "weekly"}`,
    );
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute(
      "data-state",
      pending ? "loading" : "error",
    );
    await expect(
      panel(page).locator(".fl-weekly-metrics,.fl-weekly-discoveries,.fl-weekly-next"),
    ).toHaveCount(0);
    await expect(panel(page)).not.toContainText("UNTRUSTED_SYNTHETIC_FAILURE_DETAILS");
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    if (!pending)
      await panel(page).getByRole("button", { name: "Try again", exact: true }).press("Enter");
    await expect(page.locator(".fl-weekly-discoveries article")).toHaveCount(3);
    await context.close();
    record(`weekly ${pending ? "pending" : "error"} hides invented content and recovers`);
  }
  {
    const { page, context } = await open("screen=weekly");
    await expect(page.locator(".fl-weekly-discoveries article")).toHaveCount(3);
    await page.evaluate(async () => {
      window.__core.fail = "weekly";
      await window.__coreQueries.refetchQueries({ queryKey: ["weekly-intelligence-review"] });
    });
    await expect(panel(page).locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(
      page.locator(".fl-weekly-metrics,.fl-weekly-discoveries,.fl-weekly-next"),
    ).toHaveCount(0);
    await context.close();
    record("weekly failed refresh hides stale metrics and actions");
  }
  {
    const { page, context } = await open("screen=weekly&scenario=empty&lang=lt&theme=light", {
      width: 320,
      height: 900,
    });
    await expect(page.locator(".fl-weekly-metrics dd")).toHaveText(["0", "0", "—"]);
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "empty");
    await expect(page.locator(".fl-weekly-discoveries article")).toHaveCount(0);
    await noOverflow(page);
    await context.close();
    record("weekly Lithuanian 320px true empty review keeps readiness unknown");
  }
  for (const theme of ["light", "dark"]) {
    const { page, context } = await open(
      `screen=weekly&scenario=unreadable&theme=${theme}&lang=lt&shell=1&route=/twin`,
      { width: 390, height: 900 },
    );
    await expect(page.locator(".fl-weekly-metrics dd")).toHaveText(["3", "4", "52,5/100"]);
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(page.locator("[data-review-status]")).toHaveAttribute(
      "data-review-status",
      "partial",
    );
    await expect(panel(page)).not.toContainText("Turimų įrašų dar nepakanka");
    await capture(page, {
      name: `weekly-unreadable-${theme}-390`,
      lang: "lt",
      theme,
      width: 390,
      scenario: "unreadable",
    });
    await page.evaluate(() => {
      window.__core.last.weeklyScenario = "ready";
    });
    await page.getByRole("button", { name: "Bandyti dar kartą", exact: true }).press("Enter");
    await expect(page.locator(".fl-weekly-discoveries article")).toHaveCount(3);
    await context.close();
    record(`weekly ${theme} unavailable patterns retain verified totals and support retry`);
  }
  for (const source of ["training", "recovery"]) {
    const { page, context } = await open(`screen=weekly&scenario=partial-${source}&theme=light`, {
      width: 320,
      height: 900,
    });
    await expect(page.locator(".fl-weekly-metrics dd")).toHaveText(
      source === "training" ? ["—", "4", "52.5/100"] : ["3", "—", "—"],
    );
    await expect(page.locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(page.locator(".fl-weekly-coverage li")).toContainText("temporarily unavailable");
    await noOverflow(page);
    await context.close();
    record(`weekly missing ${source} source is unknown, not zero`);
  }
  {
    const { page, context } = await open("screen=weekly&scenario=no-average");
    await expect(page.locator(".fl-weekly-metrics dd")).toHaveText(["3", "4", "—"]);
    await context.close();
    record("weekly missing average readiness stays unknown without hiding available counts");
  }
  for (const [action, route] of Object.entries({
    start_training: "/training",
    check_readiness: "/readiness",
    log_nutrition: "/nutrition",
    log_body_metrics: "/twin",
    set_training_rhythm: "/me",
    open_today: "/app",
  })) {
    const { page, context } = await open(`screen=weekly&action=${action}`);
    const link = page.locator(".fl-weekly-next a");
    await expect(link).toBeVisible();
    expect(new URL(await link.getAttribute("href"), page.url()).searchParams.get("route")).toBe(
      route,
    );
    await link.press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("route") === route);
    await context.close();
    record(`weekly ${action} keeps its destination and supports keyboard activation`);
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(`screen=weekly&lang=${lang}`, { width: 320, height: 900 });
    await expect(page.getByRole("heading", { name: "Your week, in perspective" })).toBeVisible();
    await expect(page.locator(".fl-weekly-discoveries article").first()).toContainText(
      "You completed 12 workouts",
    );
    await expect(page.locator(".fl-weekly-discoveries footer").first()).toContainText("Evidence:");
    await expect(panel(page)).not.toContainText("UNTRUSTED_SYNTHETIC_SOURCE_TEXT");
    await noOverflow(page);
    await context.close();
    record(`weekly ${lang} falls back to app-owned English evidence at 320px`);
  }
  await writeFile(
    path.join(artifacts, "weekly-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
