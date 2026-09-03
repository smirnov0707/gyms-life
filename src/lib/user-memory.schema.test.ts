import { describe, expect, it } from "vitest";
import {
  buildActiveMemoryForAi,
  calculatedMemoryValueForTransparency,
  CorrectUserMemoryInputSchema,
  parseUserMemoryTransparencyItems,
} from "./user-memory.schema";

const row = {
  id: "018f2e48-5e6d-7b8c-9d0e-1f2a3b4c5d6e",
  memory_type: "training_pattern",
  content: "Shorter sessions are easier to complete.",
  source: "calculated",
  confidence: 0.75,
  importance: 0.8,
  status: "active",
  evidence_refs: ["workout-session-1", "workout-session-2"],
  last_confirmed_at: "2026-09-03T09:00:00.000Z",
  expires_at: null,
};

describe("user memory transparency contracts", () => {
  it("exposes provenance and evidence count without leaking raw evidence", () => {
    expect(parseUserMemoryTransparencyItems([row])).toEqual([
      {
        id: row.id,
        type: "training_pattern",
        content: row.content,
        source: "calculated",
        confidence: 0.75,
        importance: 0.8,
        status: "active",
        calculatedValue: null,
        evidenceCount: 2,
        lastConfirmedAt: row.last_confirmed_at,
        expiresAt: null,
      },
    ]);
  });

  it("exposes only a validated calculated value for a user-facing evidence explanation", () => {
    const memory = parseUserMemoryTransparencyItems([
      {
        ...row,
        value: {
          kind: "recovery_low_7d",
          averageReadiness: 52.5,
          checkinsLast7Days: 4,
          windowDays: 7,
        },
      },
    ]).at(0);
    if (memory === undefined) throw new Error("Expected a parsed memory item.");

    expect(calculatedMemoryValueForTransparency(memory)).toEqual({
      kind: "recovery_low_7d",
      averageReadiness: 52.5,
      checkinsLast7Days: 4,
      windowDays: 7,
    });
    expect(calculatedMemoryValueForTransparency({ ...memory, source: "user_reported" })).toBeNull();
    expect(calculatedMemoryValueForTransparency({ ...memory, calculatedValue: null })).toBeNull();
  });

  it("rejects invalid raw rows before they reach the user interface", () => {
    expect(() => parseUserMemoryTransparencyItems([{ ...row, source: "unknown" }])).toThrow();
    expect(() => parseUserMemoryTransparencyItems([{ ...row, evidence_refs: {} }])).toThrow();
  });

  it("creates a bounded AI-memory contract without IDs, dates, evidence references, or context", () => {
    const result = buildActiveMemoryForAi([
      row,
      { ...row, memory_type: "current_context", content: "Temporary equipment limit" },
      { ...row, status: "incorrect", content: "Rejected memory" },
    ]);

    expect(result).toEqual({
      available: true,
      entries: [
        {
          type: "training_pattern",
          content: row.content,
          source: "calculated",
          confidence: 0.75,
          importance: 0.8,
        },
      ],
    });
  });

  it("accepts a bounded explicit correction and normalizes surrounding whitespace", () => {
    expect(
      CorrectUserMemoryInputSchema.parse({
        memoryId: row.id,
        content: "  I prefer sessions closer to 45 minutes.  ",
      }),
    ).toEqual({
      memoryId: row.id,
      content: "I prefer sessions closer to 45 minutes.",
    });
  });

  it("rejects blank, oversized, and malformed corrections", () => {
    expect(() =>
      CorrectUserMemoryInputSchema.parse({ memoryId: row.id, content: "   " }),
    ).toThrow();
    expect(() =>
      CorrectUserMemoryInputSchema.parse({ memoryId: row.id, content: "a".repeat(401) }),
    ).toThrow();
    expect(() =>
      CorrectUserMemoryInputSchema.parse({ memoryId: "not-a-uuid", content: "Updated fact" }),
    ).toThrow();
  });
});
