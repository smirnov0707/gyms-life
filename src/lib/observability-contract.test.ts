import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Telemetry that fails is telemetry that vanishes.
 *
 * `recordObservabilityEvent` parses its input and swallows anything that does
 * not fit, on purpose: unavailable telemetry must never block a workout, a
 * meal plan, or an AI call. That is right, and it is also how a broken write
 * runs for weeks unseen — production held 233 failed timeline writes and an
 * empty timeline table before anybody looked, and the same silence protects
 * this module.
 *
 * So the parts of the contract a call site can break are checked here, where
 * a mismatch is a failing test rather than a missing row.
 *
 * These walk the source rather than importing, because the point is what call
 * sites are written to send, not what one of them sends at runtime.
 */

const SRC = path.resolve("src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const sources = () => walk(SRC).map((file) => ({ file, text: readFileSync(file, "utf8") }));

const observabilityModule = () =>
  readFileSync(path.join(SRC, "lib", "observability.server.ts"), "utf8");

function declaredEventNames(): string[] {
  const block = /ObservabilityEventNameSchema = z\.enum\(\[([\s\S]*?)\]\)/.exec(
    observabilityModule(),
  );
  if (!block) throw new Error("The observability event enum could not be found.");
  return [...(block[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
}

function emittedEventNames(): { name: string; file: string }[] {
  return sources().flatMap(({ file, text }) =>
    [...text.matchAll(/eventName:\s*"([^"]+)"/g)].map((match) => ({
      name: match[1] ?? "",
      file: path.relative(SRC, file).split(path.sep).join("/"),
    })),
  );
}

describe("the observability event contract", () => {
  it("declares every event name a call site sends", () => {
    // A name outside the enum fails the parse, and the write is swallowed. The
    // feature keeps working and its telemetry silently stops existing.
    const declared = new Set(declaredEventNames());
    const undeclared = emittedEventNames()
      .filter((event) => !declared.has(event.name))
      .map((event) => `${event.file}: ${event.name}`);
    expect(undeclared).toEqual([]);
  });

  it("declares no event name nothing sends", () => {
    // The other direction is cheaper but not free: a name nobody emits is a
    // dashboard row that will never appear and a reader who cannot tell
    // whether the feature is quiet or gone.
    const emitted = new Set(emittedEventNames().map((event) => event.name));
    expect(declaredEventNames().filter((name) => !emitted.has(name))).toEqual([]);
  });

  it("keeps every event name in the shape the enum expects", () => {
    for (const name of declaredEventNames()) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
    }
  });
});

describe("the metadata a call site sends", () => {
  /** `metadata: { ... }` written literally, with no nesting to confuse the count. */
  const literalMetadata = () =>
    sources().flatMap(({ file, text }) =>
      [...text.matchAll(/metadata:\s*\{([^{}]*)\}/g)].map((match) => ({
        file: path.relative(SRC, file).split(path.sep).join("/"),
        body: match[1] ?? "",
      })),
    );

  it("stays inside the eight-value limit the schema enforces", () => {
    // A ninth value fails the parse and takes the whole event with it — the
    // event that was being sent because something went wrong.
    const tooMany = literalMetadata()
      .map((entry) => ({
        ...entry,
        keys: [...entry.body.matchAll(/(^|,)\s*([a-zA-Z_][\w]*)\s*:/g)].length,
      }))
      .filter((entry) => entry.keys > 8)
      .map((entry) => `${entry.file}: ${entry.keys} values`);
    expect(tooMany).toEqual([]);
  });

  it("uses key names the schema accepts", () => {
    // `^[a-z][a-z0-9_]{0,63}$`. A camelCase key is the easy mistake, and it
    // costs the whole event rather than the one field.
    const badKeys = literalMetadata().flatMap((entry) =>
      [...entry.body.matchAll(/(^|,)\s*([a-zA-Z_][\w]*)\s*:/g)]
        .map((match) => match[2] ?? "")
        .filter((key) => !/^[a-z][a-z0-9_]{0,63}$/.test(key))
        .map((key) => `${entry.file}: ${key}`),
    );
    expect(badKeys).toEqual([]);
  });
});
