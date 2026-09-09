import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const ImageSchema = z
  .object({
    schema: z.literal("gyms-ci-browser-image.v1"),
    playwrightVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    image: z.string(),
    source: z.literal("https://playwright.dev/docs/docker"),
  })
  .strict();
export function verifyBrowserImage(value, versions) {
  const spec = ImageSchema.parse(value);
  const prefix = `mcr.microsoft.com/playwright:v${spec.playwrightVersion}-noble@sha256:`;
  if (!spec.image.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(spec.image.slice(prefix.length)))
    throw new Error("CI_BROWSER_IMAGE_NOT_DIGEST_PINNED");
  if (versions.length !== 3 || versions.some((version) => version !== spec.playwrightVersion))
    throw new Error("CI_BROWSER_VERSION_MISMATCH");
  return spec;
}
async function main() {
  const versions = ["@playwright/test", "playwright", "playwright-core"].map(
    (name) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")).version,
  );
  const spec = verifyBrowserImage(
    JSON.parse(readFileSync(".github/playwright-image.json", "utf8")),
    versions,
  );
  if (process.platform !== "linux" || process.env.PLAYWRIGHT_BROWSERS_PATH !== "/ms-playwright")
    throw new Error("EXPECTED_OFFICIAL_BROWSER_CONTAINER");
  const { chromium, webkit } = await import("@playwright/test");
  for (const browser of [chromium, webkit]) {
    if (
      !browser.executablePath().startsWith("/ms-playwright/") ||
      !existsSync(browser.executablePath())
    )
      throw new Error("MATCHING_PREINSTALLED_BROWSER_MISSING");
  }
  const report = {
    scope: "Pinned browser environment prerequisite only; actual test commands still required",
    image: spec.image,
    version: spec.playwrightVersion,
    chromiumPresent: true,
    webkitPresent: true,
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/ci-browser-runtime.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
