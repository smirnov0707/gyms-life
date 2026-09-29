import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Four ways the offline queue can refuse a set, and four different things the
 * athlete should do about them.
 *
 * `OfflineQueueFailure` models `queue_full`, `storage_rejected`,
 * `storage_unavailable` and `identity_changed`. The workout screen mapped them
 * with a single ternary — `queue_full` to one message and everything else to
 * "This device has no room left to store the set… free some space". So an
 * athlete whose IndexedDB would not open, because another tab held it, was told
 * to delete photos; and an athlete whose signed-in account changed mid-save was
 * told the same. Both are advice that cannot work, given to somebody standing
 * in a gym between sets.
 *
 * `Record<OfflineQueueFailure, string>` makes the compiler demand an entry for
 * every reason. It cannot demand that the entries differ, which is precisely
 * what went wrong, so that is checked here.
 */

const SCREEN = path.resolve("src/routes/_authenticated/workout/$day.tsx");
const CONTRACT = path.resolve("src/lib/offline-contract.ts");

/** The reasons the contract declares, read from the union it exports. */
function declaredReasons(): string[] {
  const source = readFileSync(CONTRACT, "utf8");
  const union = /export type OfflineQueueFailure =([\s\S]*?);/.exec(source)?.[1] ?? "";
  return [...union.matchAll(/"([a-z_]+)"/g)].map((match) => match[1] ?? "");
}

/** `reason: copy.field` pairs from the screen's mapping table. */
function mappedCopy(): Map<string, string> {
  const source = readFileSync(SCREEN, "utf8");
  const block = /OFFLINE_COPY[^=]*=\s*\{([\s\S]*?)\n {6}\};/.exec(source)?.[1] ?? "";
  return new Map(
    [...block.matchAll(/([a-z_]+):\s*copy\.(\w+)/g)].map((match) => [
      match[1] ?? "",
      match[2] ?? "",
    ]),
  );
}

describe("what the athlete is told when the offline queue refuses a set", () => {
  it("has a message for every reason the contract can produce", () => {
    const mapped = mappedCopy();
    expect(mapped.size).toBeGreaterThanOrEqual(4);
    for (const reason of declaredReasons()) expect([...mapped.keys()]).toContain(reason);
  });

  it("does not give two different problems the same answer", () => {
    // The defect. Three reasons shared one message, and for two of them that
    // message named a cause that was not theirs and an action that could not
    // help.
    const fields = [...mappedCopy().values()];
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("never sends somebody to free disk space for a problem that is not disk space", () => {
    const mapped = mappedCopy();
    expect(mapped.get("storage_unavailable")).not.toBe(mapped.get("storage_rejected"));
    expect(mapped.get("identity_changed")).not.toBe(mapped.get("storage_rejected"));
  });

  it("is still reading the screen it claims to read", () => {
    // A regex over source passes forever once it stops matching anything.
    expect(declaredReasons()).toContain("identity_changed");
    expect(mappedCopy().get("queue_full")).toBe("offlineQueueFull");
  });
});
