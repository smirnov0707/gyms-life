import path from "node:path";
import { expect } from "@playwright/test";

/** Freeze before the fixture creates any timers; startup cost is not simulated network delay. */
export async function freezeTwinClock(page) {
  const start = new Date("2026-09-09T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
}

/** Exercise real route components, clocks, cancellation and fresh retry scenes. */
export async function verifyTwinLoadingLifecycle({
  browser,
  artifacts,
  expectedSource,
  expectedCredit,
  expectedSha,
  record,
}) {
  const timeoutCopy = "The 3D model took too long to load. Your evidence is still available in 2D.";
  for (const scenario of ["model-timeout", "import-timeout", "manual-2d"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const held = [];
    const errors = [];
    const pattern = scenario === "import-timeout" ? "**/twin-scene.runtime.ts*" : "**/*.glb";
    page.on("pageerror", (error) => errors.push(String(error)));
    // Install before application timers are created; never replace live timers.
    await freezeTwinClock(page);
    await page.route(pattern, (route) => {
      held.push(route);
    });
    try {
      await page.goto("http://127.0.0.1:4179/index.html");
      await expect.poll(() => held.length, { timeout: 30_000 }).toBeGreaterThan(0);
      await expect(page.getByRole("status").filter({ hasText: "Preparing 3D" })).toBeVisible();
      if (scenario !== "import-timeout") {
        await expect(page.locator("canvas")).toHaveAttribute("data-twin-body", "loading");
      }
      if (scenario === "manual-2d") {
        await page.getByRole("button", { name: "2D", exact: true }).click();
      } else {
        // The public 15-second limit, not a private implementation timer.
        await page.clock.fastForward(15_001);
        await expect(page.getByText(timeoutCopy, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Try 3D again", exact: true })).toBeVisible();
      }
      await expect(page.locator("[data-twin-stage]")).toHaveAttribute("data-twin-stage", "2d");
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.locator("[data-twin-credit]")).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Preparing 3D" })).toHaveCount(0);
      // The failed/cancelled attempt must not wake its 20-second surface timer.
      await page.clock.fastForward(25_000);
      await expect(page.locator("canvas")).toHaveCount(0);
      await page.screenshot({ path: path.join(artifacts, `${scenario}.png`), fullPage: true });
      // Removing interception first auto-handles pending routes in Playwright.
      // Finish the held routes before unregistering them; never handle one twice.
      await Promise.all(held.map((route) => route.continue()));
      await page.unroute(pattern);
      // Let the released module/fetch promise settle before a fresh attempt.
      await page.waitForTimeout(300);
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.locator("[data-twin-credit]")).toHaveCount(0);
      if (scenario === "manual-2d") {
        await expect(page.getByText(timeoutCopy, { exact: true })).toHaveCount(0);
      }
      await page
        .getByRole("button", {
          name: scenario === "manual-2d" ? "3D" : "Try 3D again",
          exact: true,
        })
        .click();
      await expect(page.locator("[data-twin-stage]")).toHaveAttribute(
        "data-twin-source",
        expectedSource,
        { timeout: 30_000 },
      );
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(page.locator("canvas")).toHaveAttribute("data-twin-asset-sha256", expectedSha);
      await expect(page.locator("[data-twin-credit]")).toContainText(expectedCredit);
      await expect(page.getByText(timeoutCopy, { exact: true })).toHaveCount(0);
      // A successful retry is not destroyed by either the old or new deadline.
      await page.clock.fastForward(25_000);
      await expect(page.locator("[data-twin-stage]")).toHaveAttribute("data-twin-stage", "3d");
      await expect(page.locator("canvas")).toHaveCount(1);
      expect(errors).toEqual([]);
      record(
        `${scenario}: 2D remains available, late work is ignored, retry verifies the real model`,
      );
    } finally {
      await context.close();
    }
  }
}
