import { describe, expect, it } from "vitest";
import { parseCoachMessageHistory } from "./coach-message.schema";

const validRow = {
  id: "7b4f7d5a-3b46-4bf5-a1b4-9c0f1d2e3a4b",
  role: "coach",
  content: "Add weight only if all planned sets were controlled.",
  created_at: "2026-09-03T04:00:00+00:00",
};

describe("coach message domain", () => {
  it("normalizes a typed database row into the client message contract", () => {
    expect(parseCoachMessageHistory([validRow])).toEqual([
      {
        id: validRow.id,
        role: "coach",
        content: validRow.content,
        createdAt: validRow.created_at,
      },
    ]);
  });

  it("keeps malformed legacy rows out of the chat domain", () => {
    expect(
      parseCoachMessageHistory([
        validRow,
        { ...validRow, id: "not-a-uuid" },
        { ...validRow, role: "system" },
        { ...validRow, content: "   " },
      ]),
    ).toEqual([
      {
        id: validRow.id,
        role: "coach",
        content: validRow.content,
        createdAt: validRow.created_at,
      },
    ]);
  });
});
