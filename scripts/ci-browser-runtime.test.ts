import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { verifyBrowserImage } from "./verify-ci-browser-runtime.mjs";
const image = JSON.parse(readFileSync(".github/playwright-image.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const versions = ["@playwright/test", "playwright", "playwright-core"].map(
  (name) => lock.packages[`node_modules/${name}`].version,
);
const workflows = [
  "anatomy-candidate",
  "auth-browser",
  "body-replay-browser",
  "core-browser",
  "night-review",
  "offline-browser",
  "today-browser",
  "twin-browser",
];
describe("reproducible browser test runtime", () => {
  it("pins the official image digest to the exact locked Playwright version", () => {
    expect(verifyBrowserImage(image, versions)).toEqual(image);
  });
  it.each(workflows)(
    "%s uses the same image and validates preinstalled browsers before running tests",
    (name) => {
      const source = readFileSync(`.github/workflows/${name}.yml`, "utf8");
      expect(source).toContain(image.image);
      expect(source.match(/^ {4}container:/gm)).toHaveLength(1);
      expect(source).toContain("node scripts/verify-ci-browser-runtime.mjs");
      expect(source).not.toContain("install --with-deps");
      expect(source).toContain(".github/playwright-image.json");
      expect(source).toContain("scripts/verify-ci-browser-runtime.mjs");
    },
  );
  it("mismatched dependencies cannot reuse a superficially installed browser", () => {
    expect(() => verifyBrowserImage(image, [versions[0], versions[1], "0.0.0"])).toThrow(
      "CI_BROWSER_VERSION_MISMATCH",
    );
  });
  it.each([
    image.image.split("@")[0],
    image.image.replace("mcr.microsoft.com", "untrusted.example"),
    image.image.replace(/sha256:.+/, "sha256:bad"),
  ])("rejects a mutable/unapproved image %s", (value) => {
    expect(() => verifyBrowserImage({ ...image, image: value }, versions)).toThrow(
      "CI_BROWSER_IMAGE_NOT_DIGEST_PINNED",
    );
  });
  it("the anatomy geometry job remains an ordinary runner job", () => {
    const source = readFileSync(".github/workflows/anatomy-candidate.yml", "utf8");
    const geometry = source.slice(source.indexOf("  geometry:"), source.indexOf("  browser:"));
    expect(geometry).not.toContain("container:");
    expect(geometry).toContain("audit-native-glb.selftest.mjs");
  });
});
