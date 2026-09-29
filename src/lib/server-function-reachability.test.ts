import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A server function nothing calls is a feature that is not in the product.
 *
 * `createServerFn` publishes an authenticated HTTP endpoint whether or not any
 * screen reaches it, so an orphaned one keeps type-checking, keeps passing its
 * own tests, keeps building, and keeps being deployed. Two ways to get one, and
 * they need opposite responses:
 *
 *   - Its caller was removed. `afcc9b0` rewrote the public landing and dropped
 *     `generateMotivation` with it. The endpoint stayed — authenticated,
 *     reachable, and spending the athlete's AI quota on copy no page shows.
 *     That is leftovers, and the answer is to finish the removal.
 *
 *   - Its caller was never written. `createPersonalExperiment` is the only way
 *     a personal experiment can come into existence, and nothing calls it,
 *     while the Experiment Ledger can list, transition and record outcomes for
 *     experiments. `personal_experiments` holds zero rows in production and
 *     always will. That is not dead code; it is three quarters of a feature,
 *     and the answer is a product decision, not a deletion.
 *
 * Tests do not count as callers. A function reachable only from its own test is
 * exercised, not shipped.
 */

const SRC = path.resolve("src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const relative = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

/** Product source only: a test referring to a function does not put it in the app. */
const productSources = () =>
  new Map(
    walk(SRC)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .map((file) => [relative(file), readFileSync(file, "utf8")] as const),
  );

type ServerFunction = { file: string; name: string };

function declaredServerFunctions(sources: Map<string, string>): ServerFunction[] {
  return [...sources].flatMap(([file, text]) =>
    [...text.matchAll(/export const (\w+)\s*=\s*createServerFn\(/g)].map((match) => ({
      file,
      name: match[1] ?? "",
    })),
  );
}

function unreachable(sources: Map<string, string>): ServerFunction[] {
  return declaredServerFunctions(sources).filter(({ file, name }) => {
    const mention = new RegExp(`\\b${name}\\b`);
    for (const [other, text] of sources) if (other !== file && mention.test(text)) return false;
    return true;
  });
}

/**
 * Known and decided. An entry is a claim that somebody looked and chose to
 * leave it, and the reason belongs here where the next reader will see it.
 */
const KNOWN_UNREACHABLE = new Map<string, string>([
  [
    "lib/personal-experiment.functions.ts:createPersonalExperiment",
    "The Experiment Ledger can list, transition and record outcomes, but nothing " +
      "creates an experiment. Building that entry point is a product decision about " +
      "protocol, governance and safety, not a defect fix — so it is recorded here " +
      "rather than quietly deleted or quietly ignored.",
  ],
]);

describe("every server function", () => {
  it("is reachable from the product, or recorded as a known gap", () => {
    const surprises = unreachable(productSources())
      .map((fn) => `${fn.file}:${fn.name}`)
      .filter((key) => !KNOWN_UNREACHABLE.has(key));
    expect(surprises).toEqual([]);
  });

  it("is checked across the whole application, not a sample", () => {
    // A scan that silently matches nothing passes forever.
    expect(declaredServerFunctions(productSources()).length).toBeGreaterThanOrEqual(100);
  });

  it("keeps the known-gap list honest", () => {
    // An entry that is no longer unreachable is a note nobody is acting on any
    // more: the caller exists, so remove the licence rather than leave it.
    const stillUnreachable = new Set(
      unreachable(productSources()).map((fn) => `${fn.file}:${fn.name}`),
    );
    const stale = [...KNOWN_UNREACHABLE.keys()].filter((key) => !stillUnreachable.has(key));
    expect(stale).toEqual([]);
  });

  it("recognises the shape it is looking for", () => {
    const sources = new Map([
      ["lib/a.functions.ts", 'export const doThing = createServerFn({ method: "POST" })'],
      ["components/B.tsx", "import { doThing } from '@/lib/a.functions';"],
      ["lib/c.functions.ts", 'export const orphan = createServerFn({ method: "GET" })'],
    ]);
    expect(unreachable(sources).map((fn) => fn.name)).toEqual(["orphan"]);
  });
});
