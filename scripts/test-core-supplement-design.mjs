import { expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const photoTool = (page) => page.locator(".fl-supplement-tool").nth(0);
const addForm = (page) => page.locator("#supplement-add");
const list = (page) => page.locator(".fl-supplement-list");
const image = {
  name: "synthetic-label.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function labelDraft(page) {
  await photoTool(page).locator("summary").click();
  await photoTool(page).locator("input[type=file]").setInputFiles(image);
  await expect(photoTool(page).getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
    "Synthetic scanned label",
  );
}

export async function verifySupplementDesign({ open, record, artifacts }) {
  const captures = [];
  for (const screen of ["routine", "empty", "label"]) {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 390]) {
        const { page, context } = await open(
          `screen=supplements&shell=1&theme=${theme}&scenario=${screen === "empty" ? "empty" : "ready"}`,
          { width, height: width === 390 ? 844 : 1000 },
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        const workspace = page.locator(".fl-supplement-workspace");
        await expect(workspace.locator("h1")).toHaveText("A little more organised.");
        await expect(
          addForm(page).getByRole("textbox", { name: "Name", exact: true }),
        ).toBeEnabled();
        await expect(
          page
            .getByRole("navigation", { name: "Nutrition modes" })
            .getByRole("link", { name: "Supplements", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.locator(".fl-supplement-list > li")).toHaveCount(
          screen === "empty" ? 0 : 3,
        );
        await expect(page.locator(".fl-supplement-timeline > li")).toHaveCount(
          screen === "empty" ? 0 : 2,
        );
        expect(await page.evaluate(() => window.__core.counts.scanMicronutrients ?? 0)).toBe(0);
        if (screen === "label") await labelDraft(page);
        await page.evaluate(() => document.fonts.ready);
        const audit = await workspace.evaluate((el) => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          nestedMain: document.querySelectorAll("main main").length,
          titleFont: getComputedStyle(el.querySelector("h1")).fontFamily,
          smallControls: [...el.querySelectorAll("button,summary")]
            .filter((item) => {
              const r = item.getBoundingClientRect();
              return r.height > 0 && r.height < 43;
            })
            .map((item) => item.textContent),
        }));
        expect(audit.overflow).toBe(false);
        expect(audit.nestedMain).toBe(0);
        expect(audit.titleFont).toContain("Space Grotesk");
        expect(audit.smallControls).toEqual([]);
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const name = `supplements-${screen}-${theme}-${width}`;
        const png = await page.screenshot({
          path: path.join(artifacts, `${name}.png`),
          fullPage: true,
          animations: "disabled",
        });
        const capture = {
          name,
          screen,
          theme,
          width,
          bytes: png.length,
          sha256: createHash("sha256").update(png).digest("hex"),
          syntheticFixture: true,
          audit,
        };
        captures.push(capture);
        if (process.env.CORE_BROWSER_REVIEW_EMIT === "1") {
          console.log("SUPPLEMENT_UI_BEGIN " + JSON.stringify(capture));
          const encoded = png.toString("base64");
          for (let i = 0; i < encoded.length; i += 16000)
            console.log("SUPPLEMENT_UI_CHUNK " + encoded.slice(i, i + 16000));
          console.log("SUPPLEMENT_UI_END " + name);
        }
        await context.close();
        record(
          `supplements ${screen}: ${theme} ${width}px typography, navigation, touch targets and visual capture`,
        );
      }
    }
  }
  {
    const { page, context } = await open("screen=supplements&fail=supplements-pending");
    await expect(page.locator(".fl-supplement-state[role=status]")).toBeVisible();
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["—", "—", "—"]);
    await expect(addForm(page).getByRole("textbox", { name: "Name", exact: true })).toBeDisabled();
    await page.evaluate(() => {
      window.__core.fail = "supplements";
    });
    await expect(page.getByRole("alert")).toContainText("Your list is unavailable");
    await expect(page.locator(".fl-supplement-empty")).toHaveCount(0);
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["—", "—", "—"]);
    await expect(page.locator("body")).not.toContainText("Synthetic private lookup");
    await page.evaluate(() => {
      window.__core.fail = null;
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(list(page).locator(":scope > li")).toHaveCount(3);
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["2", "2", "1"]);
    // A later refresh failure must not present a cached list as current.
    await page.evaluate(() => {
      window.__core.fail = "supplements";
      return window.__coreQueries.invalidateQueries({ queryKey: ["supplements"] });
    });
    await expect(page.getByRole("alert")).toContainText("Your list is unavailable");
    await expect(list(page)).toHaveCount(0);
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["—", "—", "—"]);
    await context.close();
    record(
      "supplement initial and cached read failures remain unknown; retry restores saved entries",
    );
  }
  {
    const { page, context } = await open("screen=supplements&scenario=empty");
    const form = addForm(page);
    await expect(form.getByRole("textbox", { name: "Name", exact: true })).toBeEnabled();
    await page
      .locator(".fl-supplement-hero")
      .getByRole("button", { name: "Add supplement" })
      .click();
    await expect(form.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
    await form.getByRole("textbox", { name: "Name", exact: true }).fill("Synthetic manual entry");
    await form.getByLabel("Notes (optional)", { exact: true }).fill("Keep this saved note");
    await form.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
    await expect(
      list(page).getByRole("heading", { name: "Synthetic manual entry", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => ({
        count: window.__core.counts.addSupplements,
        dose: window.__core.supplements[0].dose,
        request: window.__core.last.addSupplements.supplements[0].dose,
      })),
    ).toEqual({ count: 1, dose: null, request: "" });
    await page.reload();
    await expect(list(page).getByRole("heading", { name: "Synthetic manual entry" })).toBeVisible();
    await list(page).getByRole("button", { name: "Pause: Synthetic manual entry" }).click();
    await expect(
      list(page).getByRole("button", { name: "Resume: Synthetic manual entry" }),
    ).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Your routine is paused." })).toBeVisible();
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["0", "0", "1"]);
    await list(page).getByRole("button", { name: "Resume: Synthetic manual entry" }).click();
    await expect(page.locator(".fl-supplement-timeline > li")).toHaveCount(1);
    await list(page).getByRole("button", { name: "Remove: Synthetic manual entry" }).click();
    await expect(page.getByRole("heading", { name: "Start with what you take." })).toBeVisible();
    await expect(page.locator(".fl-supplement-metrics dd")).toHaveText(["0", "0", "0"]);
    await context.close();
    record(
      "manual supplement entry supports keyboard save, absent dose, reload, pause, resume and removal",
    );
  }
  {
    const { page, context } = await open("screen=supplements&fail=supplement-add");
    const form = addForm(page);
    await expect(form.getByRole("textbox", { name: "Name", exact: true })).toBeEnabled();
    await form.getByRole("textbox", { name: "Name", exact: true }).fill("Keep my unsaved product");
    await form.getByRole("button", { name: "Add supplement", exact: true }).click();
    await expect(page.locator("[data-sonner-toast]")).toContainText("Something went wrong");
    await expect(form.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
      "Keep my unsaved product",
    );
    for (const [failure, action] of [
      ["supplement-toggle", "Pause"],
      ["supplement-remove", "Remove"],
    ]) {
      await page.evaluate((fail) => {
        window.__core.fail = fail;
      }, failure);
      await list(page)
        .getByRole("button", { name: `${action}: Synthetic morning product`, exact: true })
        .click();
      const operation =
        action === "Pause" ? "setSupplementActive:failed" : "removeSupplement:failed";
      await expect
        .poll(() => page.evaluate((key) => window.__core.counts[key] ?? 0, operation))
        .toBe(1);
      await expect(
        list(page).getByRole("button", { name: "Pause: Synthetic morning product" }),
      ).toBeEnabled();
      await expect(list(page).locator(":scope > li")).toHaveCount(3);
    }
    expect(await page.evaluate(() => window.__core.supplements.length)).toBe(3);
    await expect(page.locator("body")).not.toContainText("Synthetic private");
    await context.close();
    record("failed supplement writes retain drafts and saved rows while showing a generic error");
  }
  {
    const { page, context } = await open("screen=supplements");
    await labelDraft(page);
    const tool = photoTool(page);
    await tool.getByRole("textbox", { name: "Name", exact: true }).fill("Reviewed synthetic label");
    await tool.locator("summary").click();
    await tool.locator("summary").click();
    await expect(tool.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
      "Reviewed synthetic label",
    );
    await tool.getByRole("button", { name: "Save to my supplements", exact: true }).click();
    await expect(
      list(page).getByRole("heading", { name: "Reviewed synthetic label", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.__core.counts.analyzeSupplementPhoto)).toBe(1);
    const nutrient = page.locator(".fl-supplement-tool").nth(1);
    expect(await page.evaluate(() => window.__core.counts.scanMicronutrients ?? 0)).toBe(0);
    await nutrient.locator("summary").click();
    await expect(nutrient).toContainText("Synthetic fixture: no nutrient analysis available.");
    await nutrient.locator("summary").click();
    await nutrient.locator("summary").click();
    expect(await page.evaluate(() => window.__core.counts.scanMicronutrients)).toBe(1);
    await context.close();
    record(
      "optional tools run on request; editable label drafts survive folding and save only on confirmation",
    );
  }
  {
    const { page, context } = await open("screen=supplements");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.fonts.ready);
    const tool = photoTool(page);
    await tool.locator("summary").click();
    await expect(tool.getByRole("button", { name: "Start camera", exact: true })).toBeVisible();
    await page.evaluate(() => {
      const camera = {
        calls: 0,
        stopped: 0,
        pending: null,
        delay: false,
        attachments: 0,
        source: null,
      };
      window.__supplementCamera = camera;
      // Simulate the entire media boundary. An empty native MediaStream is not a
      // portable fake video source, and this suite makes no hardware-playback claim.
      const video = document.querySelector(".fl-supplement-tool video");
      Object.defineProperty(video, "srcObject", {
        configurable: true,
        get: () => camera.source,
        set: (source) => {
          camera.source = source;
          if (source) camera.attachments += 1;
        },
      });
      Object.defineProperty(video, "play", { configurable: true, value: async () => undefined });
      const devices = navigator.mediaDevices ?? {};
      if (!navigator.mediaDevices)
        Object.defineProperty(navigator, "mediaDevices", { value: devices });
      Object.defineProperty(devices, "getUserMedia", {
        configurable: true,
        value: async () => {
          camera.calls += 1;
          const stream = {
            getTracks: () => [
              {
                stop: () => {
                  camera.stopped += 1;
                },
              },
            ],
          };
          if (camera.delay)
            return new Promise((resolve) => {
              camera.pending = () => resolve(stream);
            });
          return stream;
        },
      });
    });
    expect(await page.evaluate(() => window.__supplementCamera.calls)).toBe(0);
    await tool.getByRole("button", { name: "Start camera", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__supplementCamera.calls)).toBe(1);
    await expect(tool.getByRole("button", { name: "Stop camera", exact: true })).toBeVisible();
    await tool.locator("summary").click();
    await expect.poll(() => page.evaluate(() => window.__supplementCamera.stopped)).toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__supplementCamera.source === null))
      .toBe(true);
    await tool.locator("summary").click();
    await expect(tool.getByRole("button", { name: "Start camera", exact: true })).toBeVisible();
    await page.evaluate(() => {
      window.__supplementCamera.delay = true;
    });
    await tool.getByRole("button", { name: "Start camera", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__supplementCamera.calls)).toBe(2);
    await tool.locator("summary").click();
    await page.evaluate(() => window.__supplementCamera.pending());
    await expect.poll(() => page.evaluate(() => window.__supplementCamera.stopped)).toBe(2);
    expect(await page.evaluate(() => window.__supplementCamera.attachments)).toBe(1);
    await tool.locator("summary").click();
    await expect(tool.getByRole("button", { name: "Start camera", exact: true })).toBeEnabled();
    await context.close();
    record(
      "folding the label tool releases live and late-permission camera streams without auto-restarting",
    );
  }
  for (const theme of ["light", "dark"]) {
    const { page, context } = await open(`screen=supplements&shell=1&lang=lt&theme=${theme}`, {
      width: 320,
      height: 844,
    });
    await expect(
      addForm(page).getByRole("textbox", { name: "Pavadinimas", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(page.locator("h1")).toHaveText("Daugiau tvarkos kasdien.");
    await context.close();
    record(`supplements: Lithuanian ${theme} 320px layout remains within viewport`);
  }
  await writeFile(
    path.join(artifacts, "supplement-design-review.json"),
    JSON.stringify(
      {
        captures,
        scope:
          "Synthetic data, real UI and schedule engine. No external AI, camera permission or production mutation is certified.",
      },
      null,
      2,
    ) + "\n",
  );
}
