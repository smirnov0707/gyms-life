import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A calendar day belongs to the athlete's time zone, not to the server's.
 *
 * `AGENTS.md` earned this rule from `body_metrics`, which upserts on
 * `(user_id, measured_on)`: a 01:00 weigh-in in Vilnius taken as a UTC date
 * lands on yesterday's key and overwrites the previous reading instead of
 * recording a new one. The rule was applied to that write and then not to the
 * next four places that needed it, because nothing was watching.
 *
 * What this scans for is narrow and deliberate: a calendar day derived from
 * *now*. Turning a timestamp somebody sent into the day they wrote is a
 * different operation and stays allowed — `normalizeDate` and `realDay` in
 * `health-normalize.ts` do exactly that, and `local-day.ts` is where the
 * canonical conversion lives.
 */

const SRC = path.resolve("src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Comments are stripped before scanning. `athlete-day.server.ts` documents the
 * rule by quoting the shape it forbids, and a scan that cannot tell code from
 * prose would make writing that explanation down an offence.
 */
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const sources = () =>
  walk(SRC).map((file) => ({
    file: path.relative(SRC, file).split(path.sep).join("/"),
    text: withoutComments(readFileSync(file, "utf8")),
  }));

/** `new Date()` or `new Date(Date.now() - …)`, sliced straight to a day. */
const DAY_FROM_NOW =
  /new Date\(\s*(?:\)|Date\.now\(\)[^)]*\))\s*\.toISOString\(\)\s*\.(?:slice\(\s*0\s*,\s*10\s*\)|split\("T"\)\[0\])/;

describe("a calendar day taken from the current instant", () => {
  it("is never derived from UTC now", () => {
    // `athleteDay()` on the server, `dayInTimeZone(new Date(), browserTimeZone())`
    // in the browser. Both cost one call; the UTC slice costs a measurement.
    const offenders = sources()
      .filter(({ file }) => file !== "lib/local-day.ts")
      .filter(({ text }) => DAY_FROM_NOW.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("is still watching for the shape it forbids", () => {
    // The scan is a regex over source text, so a passing run proves nothing
    // unless the pattern still matches the thing it was written to catch.
    expect(DAY_FROM_NOW.test("const day = new Date().toISOString().slice(0, 10);")).toBe(true);
    expect(
      DAY_FROM_NOW.test(
        "const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);",
      ),
    ).toBe(true);
    expect(DAY_FROM_NOW.test('const d = new Date().toISOString().split("T")[0];')).toBe(true);
  });

  it("does not report an explanation of the rule as a breach of it", () => {
    expect(
      DAY_FROM_NOW.test(
        withoutComments("// never write new Date().toISOString().slice(0, 10) for a day"),
      ),
    ).toBe(false);
    expect(
      DAY_FROM_NOW.test(
        withoutComments("/**\n * not new Date().toISOString().slice(0, 10)\n */\nconst a = 1;"),
      ),
    ).toBe(false);
    // And it must not blind itself: real code beside a comment still counts.
    expect(
      DAY_FROM_NOW.test(
        withoutComments("// a note\nconst day = new Date().toISOString().slice(0, 10);"),
      ),
    ).toBe(true);
  });

  it("leaves a day parsed from a value somebody sent alone", () => {
    // The health ingest path turns "28/08/2026" and "2026-08-28T06:00:00Z" into
    // the day they were written as. That is not a day taken from now, and
    // rewriting it to the athlete's zone would move somebody's sample.
    expect(DAY_FROM_NOW.test("return parsed.toISOString().slice(0, 10);")).toBe(false);
    expect(DAY_FROM_NOW.test("parsed.toISOString().slice(0, 10) === day")).toBe(false);
  });
});
