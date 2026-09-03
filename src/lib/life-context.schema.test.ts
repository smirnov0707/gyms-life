import { describe, expect, it } from "vitest";
import {
  LifeContextInputSchema,
  lifeContextValueFromInput,
  parseActiveLifeContext,
} from "./life-context.schema";

describe("life context contracts", () => {
  it("requires a concrete time budget when time is limited", () => {
    expect(() =>
      LifeContextInputSchema.parse({ kind: "time_limited", durationHours: 12 }),
    ).toThrow();
  });

  it("keeps a time budget as structured state rather than presentation text", () => {
    const value = lifeContextValueFromInput({
      kind: "time_limited",
      durationHours: 12,
      timeAvailableMinutes: 30,
    });

    expect(value).toEqual({ kind: "time_limited", minutes: 30 });
  });

  it("rejects an invalid raw memory value at the database boundary", () => {
    expect(() =>
      parseActiveLifeContext({
        id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
        content: "Temporary context",
        expires_at: "2026-09-04T12:00:00.000Z",
        value: { kind: "time_limited", minutes: 5 },
      }),
    ).toThrow();
  });
});
