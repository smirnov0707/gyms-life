import { describe, expect, it } from "vitest";
import {
  acknowledgeEnduranceSubmission,
  prepareEnduranceSubmission,
  readPendingEnduranceSubmission,
} from "./endurance-submission-store";
import type { EnduranceActivity } from "./endurance-activity.schema";

const OWNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "30000000-0000-4000-8000-000000000003";
const ID = "20000000-0000-4000-8000-000000000002";
const activity: EnduranceActivity = {
  kind: "run",
  source: "manual",
  environment: "outdoor",
  startedAt: "2026-10-07T21:30:00.000Z",
  durationSeconds: 1800,
  distanceMeters: 5000,
  perceivedEffort: 4,
  averageHeartRateBpm: null,
};
function storage() {
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
describe("owner-scoped pending manual run receipt", () => {
  it("persists before sending and restores the exact start, evidence and ID after reload", () => {
    const s = storage();
    const pending = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    expect(readPendingEnduranceSubmission(s, OWNER)).toEqual(pending);
    expect(pending.activity.startedAt).toBe(activity.startedAt);
  });
  it("does not replace an unresolved save or create a new ID", () => {
    const s = storage();
    const first = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    const again = prepareEnduranceSubmission(
      s,
      OWNER,
      { ...activity, distanceMeters: 9999 },
      () => {
        throw new Error("must not create");
      },
    );
    expect(again).toEqual(first);
  });
  it("does not show one owner's attempt to a different account", () => {
    const s = storage();
    prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    expect(readPendingEnduranceSubmission(s, OTHER)).toBeNull();
  });
  it("removes only the acknowledged request", () => {
    const s = storage();
    const p = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    acknowledgeEnduranceSubmission(s, p);
    expect(readPendingEnduranceSubmission(s, OWNER)).toBeNull();
  });
  it("does not erase a newer attempt when a stale response arrives", () => {
    const s = storage();
    const old = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    acknowledgeEnduranceSubmission(s, old);
    const newer = prepareEnduranceSubmission(s, OWNER, activity, () => OTHER);
    expect(() => acknowledgeEnduranceSubmission(s, old)).toThrow("STORAGE_UNAVAILABLE");
    expect(readPendingEnduranceSubmission(s, OWNER)).toEqual(newer);
  });
  it("does not erase changed evidence that reused an ID", () => {
    const s = storage();
    const old = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    const key = [...s.values.keys()][0];
    if (!key) throw new Error("Missing test receipt");
    s.values.set(
      key,
      JSON.stringify({
        version: 1,
        submission: { ...old, activity: { ...activity, perceivedEffort: 6 } },
      }),
    );
    expect(() => acknowledgeEnduranceSubmission(s, old)).toThrow("STORAGE_UNAVAILABLE");
    expect(s.values.size).toBe(1);
  });
  it.each(["{", "null", '{"version":2}', "{}"])("corruption is not an empty queue: %s", (raw) => {
    const s = storage();
    prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    const key = [...s.values.keys()][0];
    if (!key) throw new Error("Missing test receipt");
    s.values.set(key, raw);
    expect(() => readPendingEnduranceSubmission(s, OWNER)).toThrow("STORAGE_UNAVAILABLE");
    expect(() => prepareEnduranceSubmission(s, OWNER, activity, () => OTHER)).toThrow(
      "STORAGE_UNAVAILABLE",
    );
    expect([...s.values.values()][0]).toBe(raw);
  });
  it("refused writes stop before a request can be sent", () => {
    const s = storage();
    s.setItem = () => {
      throw new Error("Quota");
    };
    expect(() => prepareEnduranceSubmission(s, OWNER, activity, () => ID)).toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });
  it("silently discarded writes do not count as durable retention", () => {
    const s = storage();
    s.setItem = () => {};
    expect(() => prepareEnduranceSubmission(s, OWNER, activity, () => ID)).toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });
  it("refused reads stop rather than authorizing a new ID", () => {
    const s = storage();
    s.getItem = () => {
      throw new Error("Denied");
    };
    expect(() => prepareEnduranceSubmission(s, OWNER, activity, () => ID)).toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });
  it("failed acknowledgement deletion preserves the retry identity", () => {
    const s = storage();
    const p = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    s.removeItem = () => {};
    expect(() => acknowledgeEnduranceSubmission(s, p)).toThrow("STORAGE_UNAVAILABLE");
    expect(readPendingEnduranceSubmission(s, OWNER)).toEqual(p);
  });
  it("an already removed acknowledgement is harmless", () => {
    const s = storage();
    const p = prepareEnduranceSubmission(s, OWNER, activity, () => ID);
    acknowledgeEnduranceSubmission(s, p);
    acknowledgeEnduranceSubmission(s, p);
    expect(s.values.size).toBe(0);
  });
  it("does not silently expire unresolved submissions into a new save", () => {
    const s = storage();
    const p = prepareEnduranceSubmission(
      s,
      OWNER,
      { ...activity, startedAt: "2020-01-01T00:00:00Z" },
      () => ID,
    );
    expect(readPendingEnduranceSubmission(s, OWNER)).toEqual(p);
  });
});
