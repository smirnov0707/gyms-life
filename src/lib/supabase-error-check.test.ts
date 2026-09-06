import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The single most repeated defect in this codebase.
 *
 * `const { data } = await supabase...` drops the error, and every screen
 * downstream renders the resulting `null` or `[]` exactly as it renders a
 * genuine absence. The failure modes are all the same shape and all of them
 * are lies told confidently: "you have no programme" to an athlete who has
 * one, "no subscription" to someone paying, "complete your first workout"
 * to someone with months of history, and — worst — a route into onboarding
 * for a plan that already exists.
 *
 * It kept coming back because each fix was applied to the call site that
 * happened to be noticed. This is applied to the pattern.
 *
 * Adding an entry here is a deliberate act: it must be accompanied by a
 * comment at the call site saying why the failure is not worth reporting.
 */

const SRC = path.resolve("src");

/**
 * Reads whose failure is genuinely not worth surfacing, each documented at
 * its call site.
 */
const ALLOWED = new Set([
  // Optional targets by design: absent targets are simply not mentioned to
  // the recipe model rather than invented.
  "components/SmartFridgeScanner.tsx",
  // Session reads from local storage on focus/visibility; a failure here
  // means no session, which is what the caller already assumes.
  "lib/auth.tsx",
  "integrations/supabase/auth-attacher.ts",
  // The goal is a visible, highlighted button the athlete can change on the
  // spot, so a default is corrected by looking at the screen.
  "components/GoalExerciseSuggestions.tsx",
]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * `const { data } = await supabase` and `const { data: rows } = await supabase`.
 *
 * Built fresh per use: a shared `/g` regex carries `lastIndex` between calls,
 * so `.test()` on the second file starts mid-string and misses matches.
 */
const discardsError = () => /const \{ data(?::\s*\w+)? \} = await supabase/g;

describe("Supabase reads", () => {
  it("never discards the error", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      if (ALLOWED.has(relative)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(discardsError())) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${relative}:${line}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest", () => {
    // An entry that no longer matches anything is a rule nobody is following
    // any more — remove it rather than leave a licence lying around.
    const stale = [...ALLOWED].filter((relative) => {
      const full = path.join(SRC, relative);
      const source = readFileSync(full, "utf8");
      return !discardsError().test(source);
    });

    expect(stale).toEqual([]);
  });
});
