import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyPerformanceDesign({ open, record, artifacts }) {
  const captures = [];
  for (const lang of ["lt", "en"])
    for (const theme of ["dark", "light"])
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=performance&route=/twin&shell=1&lang=${lang}&theme=${theme}`,
          { width, height: 900 },
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(page.locator(".fl-performance-metrics dd").first()).toHaveText("16");
        await expect(page.locator(".fl-performance-metrics dd").last()).toHaveText("—");
        await expect(page.locator("[data-trend=volume] [data-performance-bar]")).toHaveCount(14);
        await expect(page.locator("[data-trend=strength] [data-performance-bar]")).toHaveCount(14);
        await expect(
          page.locator("[data-trend=volume] [data-performance-bar]").first(),
        ).toHaveAttribute("data-value", "300");
        await expect(
          page.locator("[data-trend=volume] [data-performance-bar]").last(),
        ).toHaveAttribute("style", "height: 0%;");
        await expect(
          page.locator("[data-trend=strength] [data-performance-bar]").first(),
        ).toHaveAttribute("data-value", "63");
        await expect(
          page.locator("[data-trend=strength] [data-performance-bar]").last(),
        ).toHaveAttribute("data-value", "76");
        await expect(page.locator(".fl-performance-records li").last()).toContainText("— kg");
        await page.evaluate(() => document.fonts.ready);
        for (const plot of await page.locator(".fl-performance-plot").all()) {
          const bounds = await plot.boundingBox();
          for (const track of await plot.locator(".fl-performance-bar-track").all()) {
            const box = await track.boundingBox();
            expect(box.width).toBeGreaterThan(0);
            expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
            expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
          }
          await expect(plot.locator(".fl-performance-axis > span")).toHaveCount(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const name = `performance-${lang}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, name + ".png"),
          fullPage: true,
          animations: "disabled",
        });
        const capture = {
          name,
          lang,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("PERFORMANCE_UI_BEGIN " + JSON.stringify(capture));
          const b = png.toString("base64");
          for (let i = 0; i < b.length; i += 16000)
            console.log("PERFORMANCE_UI_CHUNK " + b.slice(i, i + 16000));
          console.log("PERFORMANCE_UI_END " + name);
        }
        await context.close();
        record(
          `performance ${lang} ${theme} ${width}: latest chronological points, unknown values and responsive capture`,
        );
      }
  for (const source of ["overview", "volume", "strength"])
    for (const pending of [true, false]) {
      const { page, context } = await open(
        `screen=performance&fail=performance-${source}${pending ? "-pending" : ""}`,
      );
      const target =
        source === "overview"
          ? page.locator(".fl-performance")
          : page.locator(`[data-trend=${source}]`);
      await expect(target.locator(".fl-ledger-state")).toHaveAttribute(
        "data-state",
        pending ? "loading" : "error",
      );
      await expect(target.locator("[data-performance-bar],.fl-performance-metrics")).toHaveCount(0);
      if (source !== "overview")
        await expect(page.locator(".fl-performance-metrics")).toBeVisible();
      await page.evaluate(() => {
        window.__core.fail = null;
      });
      if (!pending)
        await target.getByRole("button", { name: "Try again", exact: true }).press("Enter");
      await expect(
        source === "overview"
          ? page.locator(".fl-performance-metrics")
          : target.locator(".fl-performance-plot"),
      ).toBeVisible();
      await context.close();
      record(
        `performance ${source} ${pending ? "pending" : "failure"} remains distinct and recovers independently`,
      );
    }
  for (const source of ["overview", "volume", "strength"]) {
    const { page, context } = await open("screen=performance");
    await expect(page.locator("[data-trend=strength] [data-performance-bar]")).toHaveCount(14);
    await page.evaluate(async (source) => {
      window.__core.fail = "performance-" + source;
      await window.__coreQueries.refetchQueries({
        queryKey: [source === "overview" ? "performance-overview" : source + "-trend"],
      });
    }, source);
    const target =
      source === "overview"
        ? page.locator(".fl-performance")
        : page.locator(`[data-trend=${source}]`);
    await expect(target.locator(".fl-ledger-state")).toHaveAttribute("data-state", "error");
    await expect(target.locator("[data-performance-bar],.fl-performance-metrics")).toHaveCount(0);
    await context.close();
    record(`performance ${source} failed refresh does not present stale data as current`);
  }
  {
    const { page, context } = await open("screen=performance&lang=lt&theme=light&scenario=empty", {
      width: 320,
      height: 900,
    });
    await expect(page.locator(".fl-ledger-state[data-state=empty]")).toHaveCount(3);
    await expect(page.locator("[data-performance-bar]")).toHaveCount(0);
    await expect(page.locator(".fl-performance-metrics dd").first()).toHaveText("0");
    await expect(page.locator(".fl-performance-metrics dd").last()).toHaveText("—");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
    record("performance Lithuanian 320px verified empty data has no invented estimates");
  }
  {
    const { page, context } = await open("screen=performance");
    const select = page.getByRole("combobox", { name: "Exercise", exact: true });
    await expect(select).toHaveValue("press");
    await select.focus();
    await select.press("ArrowDown");
    await select.press("Enter");
    await expect(select).toHaveValue("squat");
    await expect(page.locator("[data-trend=strength] [data-performance-bar]")).toHaveCount(2);
    const panel = page.locator("[data-trend=strength]");
    await panel.locator("summary").press("Enter");
    await expect(panel.getByRole("table")).toContainText("150 kg");
    await expect(panel.getByRole("table")).toContainText("160 kg");
    await expect(panel.getByRole("table")).not.toContainText("Synthetic press");
    await expect(page.locator("[data-trend=volume] [data-performance-bar]")).toHaveCount(14);
    const ownerKeys = await page.evaluate(() =>
      window.__coreQueries
        .getQueryCache()
        .getAll()
        .filter((q) =>
          ["performance-overview", "strength-trend", "volume-trend"].includes(q.queryKey[0]),
        )
        .map((q) => q.queryKey[1]),
    );
    expect(ownerKeys).toHaveLength(3);
    expect(ownerKeys.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    await context.close();
    record(
      "performance keyboard exercise selection isolates estimates and exposes exact values; queries are owner-scoped",
    );
  }
  for (const lang of ["de", "es", "fr", "pl", "ru", "uk"]) {
    const { page, context } = await open(`screen=performance&lang=${lang}`, {
      width: 320,
      height: 900,
    });
    await expect(page.getByRole("heading", { name: "Your training, over time" })).toBeVisible();
    await expect(page.locator(".fl-performance-metrics")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
    record(`performance ${lang} uses English copy fallback at 320px`);
  }
  await writeFile(
    path.join(artifacts, "performance-design-captures.json"),
    JSON.stringify(captures, null, 2),
  );
}
