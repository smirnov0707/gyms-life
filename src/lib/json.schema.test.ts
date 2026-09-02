import { describe, expect, it } from "vitest";
import { serializeJson } from "./json.schema";

describe("serializeJson", () => {
  it("accepts plain JSON data for Supabase JSON columns", () => {
    expect(serializeJson({ plan: { day: 1, completed: false } })).toEqual({
      plan: { day: 1, completed: false },
    });
  });

  it("rejects values that cannot be safely persisted as JSON", () => {
    expect(() => serializeJson({ startedAt: new Date() })).toThrow();
  });
});
