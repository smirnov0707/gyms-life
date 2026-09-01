import { describe, expect, it } from "vitest";
import { normalizeActivePlan, type ActivePlanRow } from "./active-plan.service";

const rawPlan: ActivePlanRow = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Strength",
  goal: "strength",
  weeks: 8,
  days_per_week: 3,
  created_at: "2026-09-01T00:00:00.000Z",
  data: {
    title: "Strength",
    summary: "Build strength.",
    weeks: 8,
    progression: "Add load.",
    nutrition: "Eat enough protein.",
    days: [],
  },
};

describe("normalizeActivePlan", () => {
  it("creates a validated domain plan from a raw database row", () => {
    const result = normalizeActivePlan(rawPlan);

    expect("status" in result).toBe(false);
    if (!("status" in result)) {
      expect(result.data.title).toBe("Strength");
      expect(result.daysPerWeek).toBe(3);
    }
  });

  it("returns an invalid-data state instead of asserting raw JSON", () => {
    const result = normalizeActivePlan({
      ...rawPlan,
      data: { title: "Incomplete" },
    });

    expect(result).toMatchObject({ status: "INVALID_PLAN", planId: rawPlan.id });
  });
});
