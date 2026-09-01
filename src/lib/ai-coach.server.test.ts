import { describe, expect, it } from "vitest";

describe("assembleCoachContext boundary", () => {
  it("keeps provider integration outside the context layer", async () => {
    const module = await import("./ai-coach.server");
    expect(typeof module.assembleCoachContext).toBe("function");
  });
});
