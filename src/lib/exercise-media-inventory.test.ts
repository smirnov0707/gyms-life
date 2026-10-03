import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getExerciseMedia } from "./exercise-media";

/**
 * The media map and the lookup that reads it are one decision.
 *
 * `getExerciseMedia` lowercases the slug before the lookup. 869 of the 1044
 * frame entries have an uppercase letter in the key — the raw
 * `free-exercise-db` folder names, imported wholesale — so nothing can ever
 * match them. That is not "unused media": it is unreachable by construction,
 * and the 93.7 MB behind it goes out with every deploy and reaches nobody.
 *
 * What is asserted here is the contract, not the cleanup. Deleting 94 MB of
 * images, or wiring `approved-mapping.json` so the catalogue can reach them, is
 * a product decision. `npm run inventory:media` measures the current state.
 */

const MEDIA = path.resolve("src/lib/exercise-media.ts");
const SEED = path.resolve("supabase/seed-exercises.sql");

function mapBody(name: string): string {
  const source = readFileSync(MEDIA, "utf8");
  const start = source.indexOf(`const ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) break;
  }
  return source.slice(open, i + 1);
}

const frameKeys = () =>
  [...mapBody("EXERCISE_DB_FRAMES").matchAll(/^ {2}"?([A-Za-z0-9_-]+)"?:/gm)].map(
    (m) => m[1] ?? "",
  );

const referencedPaths = () =>
  [...readFileSync(MEDIA, "utf8").matchAll(/"(\/assets\/[^"]+)"/g)].map((m) => m[1] ?? "");

const catalogueSlugs = () =>
  new Set([...readFileSync(SEED, "utf8").matchAll(/\('([a-z0-9-]+)','/g)].map((m) => m[1] ?? ""));

describe("the media the map promises", () => {
  it("is on disk, every path of it", () => {
    // A path in the map with no file behind it is a broken image on a public
    // page, and nothing else in the build would say so.
    const paths = referencedPaths();
    expect(paths.length).toBeGreaterThan(2000);
    expect(paths.filter((p) => !existsSync(`public${p}`))).toEqual([]);
  });

  it("has no lowercase key without an exercise behind it", () => {
    // A reachable key naming an exercise the catalogue does not have would
    // serve frames for something nobody can open.
    const catalogue = catalogueSlugs();
    const reachable = frameKeys().filter((key) => key === key.toLowerCase());
    expect(reachable.filter((key) => !catalogue.has(key))).toEqual([]);
    expect(reachable).toHaveLength(catalogue.size);
  });

  it("agrees with the lookup about which keys can ever be found", () => {
    // The pair. The lookup lowercases; a key that does not survive lowercasing
    // is dead weight, and the only place the two meet is at runtime.
    const unreachable = frameKeys().filter((key) => key !== key.toLowerCase());
    for (const key of unreachable.slice(0, 20)) {
      expect(getExerciseMedia(key).type).toBe("fallback");
      expect(getExerciseMedia(key).isAvailable).toBe(false);
    }
    // Reported rather than pinned: cleaning these up should not fail a test.
    expect(unreachable.length + frameKeys().filter((k) => k === k.toLowerCase()).length).toBe(
      frameKeys().length,
    );
  });

  it("serves every catalogue exercise something", () => {
    for (const slug of catalogueSlugs()) {
      expect(getExerciseMedia(slug).isAvailable).toBe(true);
    }
  });
});
