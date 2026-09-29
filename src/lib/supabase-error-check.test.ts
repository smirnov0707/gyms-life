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
  // The auth provider now checks errors through its ordered session controller.
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

/**
 * The same defect on a client that is not called `supabase`.
 *
 * Fifteen reads in this codebase go through a client handed in as an argument —
 * `client.rpc(...)`, `input.client.from(...)`, `context.supabase.from(...)` —
 * and the rule above, anchored to the literal name, looks straight past every
 * one of them. They are all correct today. That is not the same as being
 * guarded, and this file's own history is the argument: the defect kept coming
 * back because each fix was applied to the call site that happened to be
 * noticed, and a rule that only watches one spelling is a rule that watches one
 * spelling.
 *
 * Anchored on `.from(` or `.rpc(` within the same statement rather than on the
 * receiver's name, so a TanStack `fetchQuery` or an HTTP client destructuring
 * `data` is not accused of being a Supabase read.
 */
const clientDiscardsError = () =>
  /const \{ data(?::\s*\w+)? \}\s*=\s*await\s+[^;]{0,120}?\.(?:from|rpc)\(/g;

/**
 * The same defect wearing a different shape:
 *
 *     const [{ data: a }, { data: b }] = await Promise.all([...])
 *
 * The single-read rule above never saw these, and all three that existed fed
 * a prompt: the daily brief told an athlete who had just checked in to check
 * in, the supplement planner told someone taking six supplements that they
 * took none, and the meal adapter rewrote calorie targets for a body it
 * believed had eaten nothing. A destructuring pattern that binds `data`
 * without binding `error` is the tell.
 */
const batchDiscardsError = () => /const \[([\s\S]*?)\] = await Promise\.all\(/g;

function batchOffenders(source: string): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(batchDiscardsError())) {
    const pattern = match[1] ?? "";
    if (!/\bdata\b/.test(pattern) || /\berror\b/.test(pattern)) continue;
    lines.push(source.slice(0, match.index).split("\n").length);
  }
  return lines;
}

/**
 * The third shape, and the quietest:
 *
 *     const [a, b] = await Promise.all([supabase..., supabase...]);
 *     const rows = a.data ?? [];
 *
 * Nothing here destructures `data`, so neither rule above sees it, and the
 * error is never named — it is simply never asked for. The one instance that
 * existed cost the Lab every decision's evidence whenever the evidence table
 * declined to answer, and rendered the result as decisions made on no
 * evidence, in the screen whose whole subject is evidence.
 */
/**
 * Names whose error is checked as a group rather than one at a time:
 *
 *     const readFailed = [a, b, c].some((result) => result.error !== null);
 *
 * `a.error` never appears, so the per-name rule below would report a read
 * that is in fact handled. Deliberately loose — an array literal with an
 * `.error` close behind it counts — because a false accusation here costs a
 * correct file a spurious failure, while a miss costs only this one shape.
 */
function collectivelyChecked(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/\[([^[\]]*)\][\s\S]{0,200}?\.error\b/g)) {
    for (const binding of (match[1] ?? "").split(",")) {
      const name = binding.trim();
      if (/^\w+$/.test(name)) names.add(name);
    }
  }
  return names;
}

function resultBatchOffenders(source: string): number[] {
  if (!source.includes("supabase")) return [];
  const grouped = collectivelyChecked(source);
  const lines: number[] = [];
  for (const match of source.matchAll(batchDiscardsError())) {
    for (const binding of (match[1] ?? "").split(",")) {
      const name = binding.trim();
      if (!/^\w+$/.test(name) || grouped.has(name)) continue;
      const reads = new RegExp(`\\b${name}\\.data\\b`).test(source);
      const checks = new RegExp(`\\b${name}\\.error\\b`).test(source);
      if (reads && !checks) lines.push(source.slice(0, match.index).split("\n").length);
    }
  }
  return lines;
}

/**
 * The fourth shape, and the one that costs money:
 *
 *     await supabase.from("subscriptions").update({...}).eq("id", id);
 *
 * Nothing is destructured because nothing is bound at all, so every rule
 * above looks straight past it. Three existed. Two told an athlete their
 * cancellation was scheduled while the row still said otherwise; the third
 * answered Paddle with `{received: true}` for a subscription that was never
 * written — and Paddle does not retry an event it was told arrived.
 */
const unboundWrite = () =>
  /(?<![=\w])\n\s*await\s+[A-Za-z_$][\w$.]*(?:\([^()]*\))?\s*\n?\s*\.(?:from|rpc)\(/g;

function unboundWriteOffenders(source: string): number[] {
  if (!source.includes("supabase")) return [];
  return [...source.matchAll(unboundWrite())].map(
    (match) => source.slice(0, match.index).split("\n").length + 1,
  );
}

describe("Supabase reads", () => {
  it("never discards the error", () => {
    // A set, because the two destructuring rules overlap on a client named
    // `supabase`: one line reported twice reads as two defects.
    const offenders = new Set<string>();

    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      if (ALLOWED.has(relative)) continue;
      const source = readFileSync(file, "utf8");
      for (const pattern of [discardsError(), clientDiscardsError()]) {
        for (const match of source.matchAll(pattern)) {
          offenders.add(`${relative}:${source.slice(0, match.index).split("\n").length}`);
        }
      }
      for (const line of batchOffenders(source)) {
        offenders.add(`${relative}:${line}`);
      }
      for (const line of resultBatchOffenders(source)) {
        offenders.add(`${relative}:${line}`);
      }
      for (const line of unboundWriteOffenders(source)) {
        offenders.add(`${relative}:${line}`);
      }
    }

    expect([...offenders]).toEqual([]);
  });

  it("sees a read on a client it was not named after", () => {
    // The blind spot. Every one of these is the codebase's most repeated
    // defect wearing a different receiver.
    for (const dropped of [
      'const { data } = await client.rpc("commit_night_lab_review", {});',
      'const { data: rows } = await input.client.from("x").select();',
      'const { data } = await context.supabase.from("profiles").select();',
      'const { data } = await supabaseAdmin\n  .from("x")\n  .select();',
    ]) {
      expect(clientDiscardsError().test(dropped)).toBe(true);
    }
  });

  it("does not accuse a read that is not a Supabase read", () => {
    // Anchored on `.from(`/`.rpc(`, so destructuring `data` from a query cache,
    // an HTTP client or a server function stays untouched. A false accusation
    // here costs a correct file a failing build, which is how a guard gets
    // weakened rather than obeyed.
    for (const innocent of [
      "const { data } = await qc.fetchQuery(options);",
      'const { data } = await http.get("/x");',
      'const { data, error } = await client.rpc("x", {});',
      'const { data } = await loadSomething({ from: "x" });',
    ]) {
      expect(clientDiscardsError().test(innocent)).toBe(false);
    }
  });

  it("recognises the shape it is looking for, and the shape that is fine", () => {
    const dropped = [
      "const [a, b] = await Promise.all([supabase.from('x'), supabase.from('y')]);",
      "const rows = a.data ?? [];",
      "const more = b.data ?? [];",
    ].join("\n");
    expect(resultBatchOffenders(dropped)).toHaveLength(2);

    const checkedOneByOne = `${dropped}\nif (a.error || b.error) throw new Error("read failed");`;
    expect(resultBatchOffenders(checkedOneByOne)).toEqual([]);

    const checkedTogether = `${dropped}\nconst failed = [a, b].some((r) => r.error !== null);`;
    expect(resultBatchOffenders(checkedTogether)).toEqual([]);
  });

  it("sees a write whose result nothing binds", () => {
    const dropped =
      'const go = async () => {\n  await supabase.from("x").update({ a: 1 }).eq("id", 1);\n};';
    expect(unboundWriteOffenders(dropped)).toHaveLength(1);

    const bound =
      'const go = async () => {\n  const { error } = await supabase.from("x").update({ a: 1 }).eq("id", 1);\n};';
    expect(unboundWriteOffenders(bound)).toEqual([]);
  });

  it("sees an unbound write through a stored procedure or a passed-in client", () => {
    // Same two blind spots as the read rule: the receiver's name, and the
    // assumption that a write goes through `.from(`. Every RPC in this
    // codebase is a write that changes a row — a quota consumed, a plan
    // activated, a subscription applied — so an unbound one is the shape that
    // told Paddle `{received: true}` for a subscription never written.
    for (const dropped of [
      'const go = async () => {\n  await client.rpc("activate_training_plan", {});\n};',
      'const go = async () => {\n  await input.client.from("x").delete().eq("id", 1);\n};',
      'const go = async () => {\n  await supabaseAdmin.rpc("consume_ai_quota", {});\n};',
    ]) {
      expect(unboundWriteOffenders(`supabase\n${dropped}`)).toHaveLength(1);
    }
    // And a query cache still is not a database.
    expect(
      unboundWriteOffenders(
        "supabase\nconst go = async () => {\n  await qc.invalidateQueries({});\n};",
      ),
    ).toEqual([]);
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
