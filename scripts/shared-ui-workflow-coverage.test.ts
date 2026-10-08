import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sharedPaths = ["src/components/ui/**", "src/ui-design-system.css", "src/styles.css"];

describe("shared UI consumer workflow coverage", () => {
  it.each([
    ["twin-browser.yml", 2],
    ["body-replay-browser.yml", 1],
    ["command-center-browser.yml", 2],
  ] as const)("%s covers shared controls in every filtered event", (file, count) => {
    const source = readFileSync(`.github/workflows/${file}`, "utf8");
    const blocks = [...source.matchAll(/^ {4}paths:\n((?: {6}- "[^"\n]+"\n)+)/gm)];
    expect(blocks).toHaveLength(count);
    for (const block of blocks) {
      const paths = block[1]!
        .trim()
        .split("\n")
        .map((line) => line.trim().slice(3, -1));
      for (const path of sharedPaths) expect(paths).toContain(path);
    }
  });
});
