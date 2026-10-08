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

/** Inspect each checked-in job independently; one valid job cannot cover another. */
function containerJobs(source: string) {
  const jobs = source.slice(source.indexOf("\njobs:") + 1);
  const headings = Array.from(jobs.matchAll(/^ {2}([\w-]+):\s*$/gm));
  return headings
    .map((heading, index) => ({
      name: heading[1],
      source: jobs.slice(heading.index, headings[index + 1]?.index ?? jobs.length),
    }))
    .filter((job) => /^ {4}container:/m.test(job.source));
}

function verifyPinnedJob(source: string) {
  expect(source.match(/^ {4}container:/gm)).toHaveLength(1);
  const images = Array.from(source.matchAll(/^ {6}image:\s*([^\n]+)$/gm));
  expect(images).toHaveLength(1);
  expect(images[0]?.[1]?.trim()).toBe(image.image);
  const prerequisites = Array.from(
    source.matchAll(/^\s*(?:-\s*run:\s*)?node scripts\/verify-ci-browser-runtime\.mjs\s*$/gm),
  );
  expect(prerequisites).toHaveLength(1);
  const barrier = prerequisites[0]?.index ?? -1;
  for (const command of source.matchAll(/^\s*(?:-\s*run:\s*)?node scripts\/test-[^\s]+\.mjs\b/gm)) {
    expect(command.index).toBeGreaterThan(barrier);
  }
  expect(source).not.toContain("install --with-deps");
}

const syntheticJob = (name: string, pinnedImage = image.image, preflight = true) =>
  `  ${name}:\n    container:\n      image: ${pinnedImage}\n    steps:\n${
    preflight ? "      - run: node scripts/verify-ci-browser-runtime.mjs\n" : ""
  }      - run: node scripts/test-twin-browser.mjs\n`;

describe("reproducible browser test runtime", () => {
  it("pins the official image digest to the exact locked Playwright version", () => {
    expect(verifyBrowserImage(image, versions)).toEqual(image);
  });
  it.each(workflows)(
    "%s uses the same image and validates preinstalled browsers before running tests",
    (name) => {
      const source = readFileSync(`.github/workflows/${name}.yml`, "utf8");
      const jobs = containerJobs(source);
      expect(jobs).toHaveLength(name === "twin-browser" ? 2 : 1);
      if (name === "twin-browser")
        expect(jobs.map((job) => job.name)).toEqual(["browser", "skin-clarity"]);
      for (const job of jobs) verifyPinnedJob(job.source);
      expect(source).not.toContain("install --with-deps");
      expect(source).toContain(".github/playwright-image.json");
      expect(source).toContain("scripts/verify-ci-browser-runtime.mjs");
    },
  );
  it("accepts independently pinned parallel browser jobs", () => {
    const jobs = containerJobs("name: Synthetic\njobs:\n" + syntheticJob("browser") + syntheticJob("skin-clarity"));
    expect(jobs).toHaveLength(2);
    for (const job of jobs) verifyPinnedJob(job.source);
  });
  it("does not let the first job's image hide a mutable image in a second job", () => {
    const jobs = containerJobs("name: Synthetic\njobs:\n" + syntheticJob("browser") + syntheticJob("skin-clarity", image.image.split("@")[0]));
    expect(jobs).toHaveLength(2);
    expect(() => jobs.forEach((job) => verifyPinnedJob(job.source))).toThrow();
  });
  it("does not let the first job's prerequisite hide a missing second prerequisite", () => {
    const jobs = containerJobs("name: Synthetic\njobs:\n" + syntheticJob("browser") + syntheticJob("skin-clarity", image.image, false));
    expect(jobs).toHaveLength(2);
    expect(() => jobs.forEach((job) => verifyPinnedJob(job.source))).toThrow();
  });
  it("rejects a runtime prerequisite placed after the browser command", () => {
    const job = syntheticJob("late", image.image, false) + "      - run: node scripts/verify-ci-browser-runtime.mjs\n";
    expect(() => verifyPinnedJob(job)).toThrow();
  });
  it("rejects a missing container rather than treating the scan as passed", () => {
    expect(() => verifyPinnedJob("  browser:\n    steps:\n      - run: node scripts/verify-ci-browser-runtime.mjs\n")).toThrow();
    expect(containerJobs("name: Synthetic\njobs:\n")).toEqual([]);
  });
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
