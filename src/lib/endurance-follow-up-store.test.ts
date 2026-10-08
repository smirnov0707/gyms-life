import { describe, expect, it } from "vitest";
import {
  ENDURANCE_FOLLOW_UP_PREFIX as PREFIX,
  readEnduranceFollowUps,
  updateEnduranceFollowUps,
} from "./endurance-follow-up-store";
const owner = "10000000-0000-4000-8000-000000000001";
const foreign = "10000000-0000-4000-8000-000000000002";
const first = "20000000-0000-4000-8000-000000000001";
const second = "20000000-0000-4000-8000-000000000002";
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
describe("owned saved-run follow-up hints", () => {
  it("has no pending checks without stored evidence", () => {
    expect(readEnduranceFollowUps(memory(), owner)).toEqual([]);
  });
  it("survives a new reader without retaining workout measurements or plan guesses", () => {
    const s = memory();
    updateEnduranceFollowUps(s, owner, first, true);
    expect(readEnduranceFollowUps(s, owner)).toEqual([first]);
    expect(JSON.parse(s.getItem(PREFIX + owner)!)).toEqual({
      version: 1,
      ownerId: owner,
      sessionIds: [first],
    });
  });
  it("retains independent pending runs and makes repeat updates idempotent", () => {
    const s = memory();
    updateEnduranceFollowUps(s, owner, first, true);
    updateEnduranceFollowUps(s, owner, second, true);
    expect(updateEnduranceFollowUps(s, owner, first, true)).toEqual([first, second]);
  });
  it("finishing one check cannot clear another", () => {
    const s = memory();
    updateEnduranceFollowUps(s, owner, first, true);
    updateEnduranceFollowUps(s, owner, second, true);
    expect(updateEnduranceFollowUps(s, owner, first, false)).toEqual([second]);
    expect(readEnduranceFollowUps(s, owner)).toEqual([second]);
  });
  it("cleans the receipt only after the last check is complete or dismissed", () => {
    const s = memory();
    updateEnduranceFollowUps(s, owner, first, true);
    expect(updateEnduranceFollowUps(s, owner, first, false)).toEqual([]);
    expect(s.getItem(PREFIX + owner)).toBeNull();
  });
  it("isolates accounts on reads and writes", () => {
    const s = memory();
    updateEnduranceFollowUps(s, foreign, first, true);
    expect(readEnduranceFollowUps(s, owner)).toEqual([]);
    updateEnduranceFollowUps(s, owner, second, true);
    updateEnduranceFollowUps(s, owner, second, false);
    expect(readEnduranceFollowUps(s, foreign)).toEqual([first]);
  });
  it.each([
    "not-json",
    JSON.stringify({ version: 2, ownerId: owner, sessionIds: [first] }),
    JSON.stringify({ version: 1, ownerId: foreign, sessionIds: [first] }),
    JSON.stringify({ version: 1, ownerId: owner, sessionIds: ["bad"] }),
    JSON.stringify({ version: 1, ownerId: owner, sessionIds: [first, first] }),
    JSON.stringify({ version: 1, ownerId: owner, sessionIds: [first], distance: 5000 }),
  ])("does not overwrite invalid or foreign hint data: %s", (raw) => {
    const s = memory();
    s.setItem(PREFIX + owner, raw);
    expect(() => readEnduranceFollowUps(s, owner)).toThrow();
    expect(() => updateEnduranceFollowUps(s, owner, second, true)).toThrow();
    expect(s.getItem(PREFIX + owner)).toBe(raw);
  });
  it("does not turn an unreadable queue into an empty queue", () => {
    const s = memory();
    s.getItem = () => {
      throw new Error("refused");
    };
    expect(() => updateEnduranceFollowUps(s, owner, first, true)).toThrow("refused");
    expect(s.values.size).toBe(0);
  });
  it("detects a silently refused write", () => {
    const s = memory();
    s.setItem = () => {};
    expect(() => updateEnduranceFollowUps(s, owner, first, true)).toThrow("NOT_RETAINED");
  });
  it("detects a silently refused removal", () => {
    const s = memory();
    updateEnduranceFollowUps(s, owner, first, true);
    s.removeItem = () => {};
    expect(() => updateEnduranceFollowUps(s, owner, first, false)).toThrow("NOT_CLEARED");
    expect(readEnduranceFollowUps(s, owner)).toEqual([first]);
  });
  it("never silently evicts an older check at capacity", () => {
    const s = memory();
    const ids = Array.from(
      { length: 64 },
      (_, i) => `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    const raw = JSON.stringify({ version: 1, ownerId: owner, sessionIds: ids });
    s.setItem(PREFIX + owner, raw);
    expect(() => updateEnduranceFollowUps(s, owner, first, true)).toThrow("FULL");
    expect(s.getItem(PREFIX + owner)).toBe(raw);
  });
  it("rejects invalid input before accessing storage", () => {
    const s = memory();
    expect(() => updateEnduranceFollowUps(s, owner, "bad", true)).toThrow();
    expect(() => readEnduranceFollowUps(s, "bad")).toThrow();
    expect(s.values.size).toBe(0);
  });
});
