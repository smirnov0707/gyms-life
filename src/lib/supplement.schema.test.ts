import { describe, expect, it } from "vitest";
import { SupplementInputSchema, parseSupplements } from "./supplement.schema";

describe("supplement domain", () => {
  it("normalizes bounded supplement input before persistence", () => {
    expect(
      SupplementInputSchema.parse({
        name: "  Creatine monohydrate ",
        dose: " 5 g ",
        category: "creatine",
        times_per_day: "1",
        with_food: false,
        preferred_time: "post_workout",
        notes: " Daily ",
      }),
    ).toEqual({
      name: "Creatine monohydrate",
      dose: "5 g",
      category: "creatine",
      times_per_day: 1,
      with_food: false,
      preferred_time: "post_workout",
      notes: "Daily",
      is_active: true,
    });
  });

  it("excludes malformed history before it reaches the schedule", () => {
    expect(
      parseSupplements([
        {
          id: "f154ee80-6ae5-4a82-b629-c3c2119f6fd2",
          name: "Creatine",
          dose: "5 g",
          category: "creatine",
          times_per_day: 1,
          with_food: false,
          preferred_time: "post_workout",
          notes: null,
          is_active: true,
        },
        {
          id: "6fd1a020-0df0-4c99-a383-07c9246e9c2d",
          name: "",
          dose: null,
          category: "general",
          times_per_day: 1,
          with_food: false,
          preferred_time: "any",
          notes: null,
          is_active: true,
        },
      ]),
    ).toHaveLength(1);
  });
});
