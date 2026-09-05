import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The flat half of the calendar-day rule in AGENTS.md.
 *
 * `new Date().toISOString().slice(0, 10)` is the previous day for every
 * athlete east of Greenwich during their small hours. Where that string
 * becomes a `*_on` column it does not merely mislabel: `body_metrics`
 * upserts on `(user_id, measured_on)`, so a 01:30 weigh-in in Vilnius
 * overwrote the previous day's measurement instead of recording its own.
 *
 * Scoped to the code that writes to the database — server functions and the
 * public API routes. A UTC date used as a display label or a localStorage
 * key is a different, harmless thing, so this does not police the whole tree.
 */

const UTC_DAY = /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("calendar days on the write path", () => {
  it("never takes the athlete's day from the UTC slice", () => {
    const serverFunctions = walk(path.resolve("src/lib")).filter((file) =>
      /\.(functions|server)\.tsx?$/.test(file),
    );
    const apiRoutes = walk(path.resolve("src/routes/api"));

    const offenders = [...serverFunctions, ...apiRoutes]
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        // The helper's own doc comment quotes the pattern it replaces.
        return UTC_DAY.test(source) && !file.endsWith("athlete-day.server.ts");
      })
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
