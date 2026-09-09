import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages: Record<string, { version?: string }> = lock.packages;
const versionsOf = (name: string) =>
  Object.entries(packages)
    .filter(([path]) => path.endsWith(`node_modules/${name}`))
    .map(([, entry]) => entry.version ?? "");

function atLeast(version: string, minimum: string): boolean {
  // Pre-releases do not silently satisfy a security floor for a stable patch.
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const actual = version.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i]! !== required[i]!) return actual[i]! > required[i]!;
  }
  return true;
}

/** Static regression floors are not a substitute for the live npm audit job. */
describe("dependency security remediation", () => {
  it.each([
    ["sharp", "0.35.4"],
    ["toml", "4.2.0"],
    ["@netlify/functions-dev", "2.0.5"],
    ["@netlify/zip-it-and-ship-it", "15.5.1"],
  ])("keeps every resolved %s copy above its reviewed security floor", (name, minimum) => {
    const versions = versionsOf(name);
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions)
      expect(atLeast(version, minimum), `${name}@${version}`).toBe(true);
  });
  it("does not retain the unpatched extract-zip implementation", () => {
    expect(versionsOf("extract-zip")).toEqual([]);
  });
  it("does not retain the unused Nitro adapter and its old private runtime tree", () => {
    expect(versionsOf("nitro")).toEqual([]);
    expect(manifest.devDependencies.nitro).toBeUndefined();
  });
  it("does not regress any Undici 7 copy below the cache parser fixes", () => {
    for (const version of versionsOf("undici").filter((v) => v.startsWith("7.")))
      expect(atLeast(version, "7.29.0")).toBe(true);
  });
  it("keeps the resolved root synchronized with the checked-in manifest", () => {
    expect(lock.packages[""].dependencies).toEqual(manifest.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(manifest.devDependencies);
    expect(manifest.overrides.sharp).toBe("0.35.4");
  });
});
