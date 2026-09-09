import { expect } from "@playwright/test";
import path from "node:path";
/** Real UI, synthetic model answers and a synthetic browser recorder; no real microphone access. */
export async function verifyAiUi({ open, record, artifacts }) {
  {
    const { page, context } = await open("screen=ai-warmup");
    await expect(page.getByRole("heading", { name: /warm/i })).toBeVisible();
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__core.counts.smartWarmup ?? 0)).toBe(0);
    const build = page.getByRole("button").first();
    await build.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByText("Synthetic user-requested warm-up", { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.smartWarmup)).toBe(1);
    await page.screenshot({ path: path.join(artifacts, "ai-warmup.png"), fullPage: true });
    await context.close();
    record(
      "warm-up does not spend AI requests on mount and deduplicates user-triggered generation",
    );
  }
  {
    const { page, context } = await open("screen=ai-warmup&fail=warmup");
    await page.getByRole("button").first().click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Synthetic squats", { exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await page.getByRole("button").first().click();
    await expect(page.getByText("Synthetic squats", { exact: true })).toBeVisible();
    await context.close();
    record(
      "AI warm-up failure is explicit rather than a fabricated success; manual retry restores the result",
    );
  }
  const installRecorder = (page) =>
    page.evaluate(() => {
      const log = { opened: 0, stopped: 0 };
      window.__syntheticMic = log;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            log.opened++;
            return { getTracks: () => [{ stop: () => log.stopped++ }] };
          },
        },
      });
      class SyntheticRecorder {
        static isTypeSupported(type) {
          return type === "audio/mp4";
        }
        constructor(stream, options) {
          this.mimeType = options.mimeType;
          this.state = "inactive";
          this.ondataavailable = null;
          this.onstop = null;
          this.onerror = null;
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }),
          });
          queueMicrotask(() => this.onstop?.());
        }
      }
      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: SyntheticRecorder,
      });
    });
  {
    const { page, context } = await open("screen=workout&scenario=new-workout");
    await installRecorder(page);
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await page.locator("summary").filter({ hasText: "Fill this set from a voice draft" }).click();
    await page.getByRole("button", { name: "Record a set", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByRole("button", { name: "Stop recording", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__syntheticMic.opened)).toBe(1);
    await page.getByRole("button", { name: "Stop recording", exact: true }).click();
    await expect(
      page.getByText("Synthetic squat eight repetitions", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.last.voiceParse.mimeType)).toBe("audio/mp4");
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await page
      .getByRole("button", { name: "Use draft in the form and review", exact: true })
      .click();
    await expect(page.locator("#set-reps")).toHaveValue("8");
    await expect(page.locator("#set-weight")).toHaveValue("");
    expect(await page.evaluate(() => window.__syntheticMic.stopped)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await page.screenshot({ path: path.join(artifacts, "ai-voice-draft.png"), fullPage: true });
    await context.close();
    record(
      "MP4 voice recording works, releases the microphone, preserves unknown weight/RPE and fills only a reviewed draft",
    );
  }
  {
    const { page, context } = await open("screen=workout&scenario=new-workout&fail=voice");
    await installRecorder(page);
    await page.getByRole("button", { name: "Start or resume workout", exact: true }).click();
    await page.locator("summary").filter({ hasText: "Fill this set from a voice draft" }).click();
    await page.getByRole("button", { name: "Record a set", exact: true }).click();
    await page.getByRole("button", { name: "Stop recording", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record a set", exact: true })).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Use draft in the form and review", exact: true }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => window.__core.counts.logWorkoutSet ?? 0)).toBe(0);
    await context.close();
    record(
      "failed voice analysis neither creates a draft nor logs a set, and recording can be retried",
    );
  }
}
