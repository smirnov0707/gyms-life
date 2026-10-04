import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const modes = (page) => page.getByRole("group", { name: "Analysis modes" });
const choose = async (page, name) =>
  modes(page).getByRole("button", { name, exact: true }).press("Enter");
const start = (page) => page.getByRole("button", { name: "Start AR", exact: true });
const cameraStats = (page) =>
  page.evaluate(() => ({
    requests: window.__camera.requests,
    stopped: window.__camera.stopped,
    attached: window.__camera.attached,
  }));
async function fakeCamera(page) {
  // Simulates permission and playback, not a hardware device or its compatibility.
  await page.evaluate(() => {
    const s = (window.__camera = {
      requests: 0,
      stopped: 0,
      attached: 0,
      hold: false,
      deny: false,
      playFail: false,
      pending: [],
    });
    const sources = new WeakMap();
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return sources.get(this) ?? null;
      },
      set(value) {
        sources.set(this, value);
        if (value) s.attached++;
      },
    });
    HTMLMediaElement.prototype.play = async function () {
      if (s.playFail) throw new Error("Synthetic playback failure");
    };
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => 2,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          s.requests++;
          if (s.hold) await new Promise((resolve) => s.pending.push(resolve));
          if (s.deny) throw new Error("Synthetic permission denied");
          let stopped = false;
          return {
            getTracks: () => [
              {
                stop: () => {
                  if (!stopped) {
                    s.stopped++;
                    stopped = true;
                  }
                },
              },
            ],
          };
        },
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak() {},
        resume() {},
        getVoices: () => [],
        addEventListener() {},
        removeEventListener() {},
      },
    });
    window.__pose = { creating: 0, created: 0, closed: 0, hold: false, fail: false };
  });
}
async function opened(open, query = "", width = 390) {
  const result = await open(`screen=camera&shell=1&${query}`, { width, height: 900 });
  await result.page.emulateMedia({ reducedMotion: "reduce" });
  await expect(result.page.locator(".fl-camera-workspace h1")).toBeVisible();
  await result.page.evaluate(() => document.fonts.ready);
  await fakeCamera(result.page);
  return result;
}

export async function verifyCameraDesign({ open, record, artifacts }) {
  const captures = [];
  for (const state of ["idle", "settings", "technique", "position"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 390]) {
        const { page, context } = await opened(open, `theme=${theme}`, width);
        await expect(page.locator("h1")).toHaveText("Movement Scan.");
        if (state === "settings") {
          await page.getByRole("button", { name: "More settings" }).press("Enter");
          await page.getByRole("button", { name: "Manual choice" }).press("Enter");
          await expect(page.getByRole("combobox", { name: "Exercise", exact: true })).toBeVisible();
        }
        if (state === "technique") await choose(page, "Technique review");
        if (state === "position") await choose(page, "Movement profile");
        expect((await cameraStats(page)).requests).toBe(0);
        const audit = await page.locator(".fl-camera-workspace").evaluate((el) => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          font: getComputedStyle(el.querySelector("h1")).fontFamily,
          nestedMain: document.querySelectorAll("main main").length,
          smallControls: [...el.querySelectorAll("button,select,input")]
            .filter((item) => {
              const rect = item.getBoundingClientRect();
              return rect.height > 0 && rect.height < 43;
            })
            .map((item) => item.textContent),
        }));
        expect(audit.overflow).toBe(false);
        expect(audit.font).toContain("Space Grotesk");
        expect(audit.nestedMain).toBe(0);
        expect(audit.smallControls).toEqual([]);
        await page.evaluate(() => {
          document.activeElement?.blur();
          scrollTo(0, 0);
        });
        const name = `camera-${state}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, `${name}.png`),
          fullPage: true,
          animations: "disabled",
        });
        const capture = {
          name,
          state,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
          syntheticFixture: true,
          audit,
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("CAMERA_UI_BEGIN " + JSON.stringify(capture));
          const encoded = png.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("CAMERA_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("CAMERA_UI_END " + name);
        }
        await context.close();
        record(`camera ${state}: ${theme} ${width}px typography, touch targets and opt-in preview`);
      }
    }
  }
  {
    const { page, context } = await opened(open);
    await page.evaluate(() => {
      window.__pose.hold = true;
    });
    await start(page).press("Enter");
    await expect.poll(() => page.evaluate(() => window.__pose.creating)).toBe(1);
    // The detector is now being created; cancellation must close its late result.
    await expect(
      page.getByRole("button", { name: "Loading model...", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
    await page.evaluate(() => {
      window.__pose.hold = false;
    });
    await expect(start(page)).toBeEnabled();
    await expect.poll(() => page.evaluate(() => window.__pose.closed)).toBe(1);
    await start(page).press("Enter");
    await expect(page.getByRole("button", { name: "Finish set", exact: true })).toBeVisible();
    await choose(page, "Movement profile");
    await expect.poll(() => cameraStats(page)).toEqual({ requests: 1, stopped: 1, attached: 1 });
    await expect
      .poll(() => page.evaluate(() => window.__pose.created === window.__pose.closed))
      .toBe(true);
    await context.close();
    record("camera cancellation and mode change release model and active tracks");
  }
  {
    const { page, context } = await opened(open);
    await page.evaluate(() => {
      window.__camera.hold = true;
    });
    await start(page).press("Enter");
    await expect.poll(async () => (await cameraStats(page)).requests).toBe(1);
    await choose(page, "Technique review");
    await page.evaluate(() => {
      window.__camera.hold = false;
      window.__camera.pending.forEach((resolve) => resolve());
    });
    await expect.poll(() => cameraStats(page)).toEqual({ requests: 1, stopped: 1, attached: 0 });
    await context.close();
    record("late live-camera permission cannot attach after switching analysis mode");
  }
  {
    const { page, context } = await opened(open);
    await page.evaluate(() => {
      window.__camera.playFail = true;
    });
    await start(page).press("Enter");
    await expect.poll(() => cameraStats(page)).toEqual({ requests: 1, stopped: 1, attached: 1 });
    await expect(start(page)).toBeEnabled();
    await expect(page.locator(".fl-camera-evidence")).not.toContainText("Form looks good");
    await page.evaluate(() => {
      window.__camera.playFail = false;
    });
    await start(page).press("Enter");
    await expect(page.getByRole("button", { name: "Finish set", exact: true })).toBeVisible();
    await page.evaluate(() => {
      window.__camera.deny = true;
    });
    await page.getByRole("button", { name: "Front camera", exact: true }).press("Enter");
    await expect(start(page)).toBeEnabled();
    expect((await cameraStats(page)).stopped).toBe(2);
    await expect
      .poll(() => page.evaluate(() => window.__pose.created === window.__pose.closed))
      .toBe(true);
    await context.close();
    record("playback and switch failures stop tracks, release detector and allow a fresh start");
  }
  {
    const { page, context } = await opened(open);
    await choose(page, "Technique review");
    const enable = page.locator(".fl-form-review .fl-camera-idle button").first();
    await enable.press("Enter");
    await expect(page.getByRole("button", { name: "Stop camera", exact: true })).toBeVisible();
    await choose(page, "Movement profile");
    await expect.poll(() => cameraStats(page)).toEqual({ requests: 1, stopped: 1, attached: 1 });
    await choose(page, "Technique review");
    await page.evaluate(() => {
      window.__camera.hold = true;
    });
    await enable.press("Enter");
    await expect.poll(async () => (await cameraStats(page)).requests).toBe(2);
    await choose(page, "Live coach");
    await page.evaluate(() => {
      window.__camera.hold = false;
      window.__camera.pending.forEach((resolve) => resolve());
    });
    await expect.poll(() => cameraStats(page)).toEqual({ requests: 2, stopped: 2, attached: 1 });
    await context.close();
    record("technique review releases mounted streams and rejects late permission after unmount");
  }
  {
    const { page, context } = await opened(open, "fail=profile");
    await page.getByRole("button", { name: "More settings", exact: true }).press("Enter");
    await expect(page.locator("#camera-settings input[type=number]")).toHaveValue("");
    await page.getByRole("button", { name: "Full screen", exact: true }).press("Enter");
    await expect(page.locator(".fl-camera-panel.fixed #camera-settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".fl-camera-panel.fixed")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await context.close();
    record("unavailable height remains empty and fullscreen settings remain escapable");
  }
  {
    const { page, context } = await opened(open);
    await choose(page, "Movement profile");
    const picker = page.waitForEvent("filechooser");
    await page.locator(".fl-position-upload").press("Enter");
    const chooser = await picker;
    expect(chooser.isMultiple()).toBe(false);
    expect(await chooser.element().getAttribute("accept")).toBe("image/*");
    expect((await cameraStats(page)).requests).toBe(0);
    await context.close();
    record("position photo selection is keyboard accessible and does not start a live camera");
  }
  for (const theme of ["dark", "light"]) {
    const { page, context } = await opened(open, `lang=lt&theme=${theme}`, 320);
    await expect(page.locator("h1")).toHaveText("Movement Scan.");
    for (const mode of ["Gyvas treneris", "Technikos analizė", "Judesio profilis"]) {
      await page.getByRole("button", { name: mode, exact: true }).press("Enter");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
    await context.close();
    record(`camera 320px Lithuanian ${theme} layout across all three modes`);
  }
  await writeFile(
    path.join(artifacts, "camera-design-review.json"),
    JSON.stringify({ captures }, null, 2),
  );
}
