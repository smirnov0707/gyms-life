import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Pin the workflows' simple quoted path lists, not a general YAML parser.
// A helper-only edit must trigger the same GPU checks as the main harness.
const twinHarnessGlob = "scripts/test-twin-*.mjs";

describe("Twin browser workflow coverage", () => {
  it.each([
    ["twin-browser.yml", 2], // pull_request and push to main
    ["anatomy-candidate.yml", 1], // pull_request; dispatch has no path filter
  ] as const)("%s includes every Twin harness helper in all path filters", (file, count) => {
    const source = readFileSync(`.github/workflows/${file}`, "utf8");
    const blocks = [...source.matchAll(/^ {4}paths:\n((?: {6}- "[^"\n]+"\n)+)/gm)];
    expect(blocks).toHaveLength(count);
    for (const block of blocks) {
      const paths = block[1]!
        .trim()
        .split("\n")
        .map((line) => line.trim().slice(3, -1));
      expect(paths).toContain(twinHarnessGlob);
    }
  });
});
