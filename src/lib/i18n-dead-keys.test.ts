import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Over a third of this dictionary — 554 of 1549 keys — was once copy for
 * screens that had since been rewritten: an AR calibration flow replaced by
 * `nx.ar.*`, a dashboard replaced by Today, navigation labels dropped in the
 * nav restructure, and marketing lines for a holographic ghost trainer and a
 * 3D spine radar that were never built. None of it was reachable, all of it
 * shipped, and the i18n chunk is the largest asset the app loads.
 *
 * The compiler cannot catch this on its own: `TKey` is `keyof typeof dict`,
 * so it rejects a key that does not exist but says nothing about one nothing
 * asks for. This does.
 */

const SRC = path.resolve("src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const DEFINITION = /^ {2}"([a-zA-Z0-9_.-]+)":\s*\{/gm;
/** Any dotted lower-case string literal counts as a use. Deliberately
 *  generous: a false "used" costs a stale key, a false "unused" costs a
 *  broken screen. */
const LITERAL = /["'`]([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)+)["'`]/g;
/** `t(`mg.${group}` as TKey)` and friends — a whole family behind one prefix. */
const DYNAMIC = /`([a-zA-Z0-9_.-]*?)\$\{/g;

describe("translation dictionary", () => {
  it("defines no key that nothing asks for", () => {
    const files = walk(SRC).filter((file) => !file.includes("i18n-locales"));

    const defined = new Map<string, string>();
    const used = new Set<string>();
    const dynamicPrefixes = new Set<string>();

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const isDictionary = /i18n-extra-.*\.ts$|i18n\.tsx$/.test(file);

      if (isDictionary) {
        for (const match of source.matchAll(DEFINITION)) {
          if (!defined.has(match[1]!)) defined.set(match[1]!, path.basename(file));
        }
      }
      // A definition must not count as its own use.
      const searchable = isDictionary ? source.replace(DEFINITION, "") : source;
      for (const match of searchable.matchAll(LITERAL)) used.add(match[1]!);
      for (const match of source.matchAll(DYNAMIC)) {
        if (match[1]!.includes(".")) dynamicPrefixes.add(match[1]!);
      }
    }

    expect(defined.size).toBeGreaterThan(900);

    const orphans = [...defined]
      .filter(([key]) => !used.has(key))
      .filter(([key]) => ![...dynamicPrefixes].some((prefix) => key.startsWith(prefix)))
      .map(([key, file]) => `${key} (${file})`);

    expect(orphans).toEqual([]);
  });
});
