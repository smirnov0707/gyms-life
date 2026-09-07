import { describe, expect, it } from "vitest";
import { buildSchedule, SLOT_ORDER, type Supplement } from "./supplements";

/**
 * The supplement schedule is advice about absorption and timing, and it had no
 * tests. The properties that matter are the ones where it would otherwise
 * claim to have handled something it had not: a clash it says it separated, or
 * a day's doses it silently trimmed.
 */

const supp = (over: Partial<Supplement> & { id: string }): Supplement =>
  ({
    name: "Supplement",
    dose: "1",
    category: "general",
    times_per_day: 1,
    with_food: false,
    preferred_time: "any",
    notes: null,
    is_active: true,
    ...over,
  }) as Supplement;

const slotOf = (result: ReturnType<typeof buildSchedule>, id: string) =>
  result.slots.find((slot) => slot.id === id);

const categoriesIn = (result: ReturnType<typeof buildSchedule>, id: string) =>
  (slotOf(result, id)?.items ?? []).map((item) => item.supplement.category);

const placedCount = (result: ReturnType<typeof buildSchedule>) =>
  result.slots.reduce((total, slot) => total + slot.items.length, 0);

describe("buildSchedule", () => {
  it("schedules an active supplement and leaves paused ones out", () => {
    const result = buildSchedule([
      supp({ id: "a", category: "creatine" }),
      supp({ id: "b", category: "creatine", is_active: false }),
    ]);
    expect(placedCount(result)).toBe(1);
  });

  it("gives each dose its own slot", () => {
    const result = buildSchedule([supp({ id: "a", category: "general", times_per_day: 3 })]);
    expect(placedCount(result)).toBe(3);
    // Three doses, three distinct slots — never stacked into one.
    expect(result.slots.filter((slot) => slot.items.length > 0)).toHaveLength(3);
  });

  it("says so when the day has no room for every dose", () => {
    // The stored schema allows six doses a day. The scheduler used to place
    // four of them and say nothing, so a schedule presenting itself as the
    // whole day was quietly missing two.
    const result = buildSchedule([supp({ id: "a", category: "mineral", times_per_day: 6 })]);
    expect(result.warningKeys).toContain("supp.warn.dosesUnplaced");
    expect(placedCount(result)).toBeLessThan(6);
    expect(placedCount(result)).toBeGreaterThan(0);
  });

  it("says nothing about unplaced doses when they all fit", () => {
    const result = buildSchedule([supp({ id: "a", category: "general", times_per_day: 2 })]);
    expect(result.warningKeys).not.toContain("supp.warn.dosesUnplaced");
    expect(placedCount(result)).toBe(2);
  });

  it("separates iron from calcium rather than only warning about them", () => {
    const result = buildSchedule([
      supp({ id: "i", category: "iron", preferred_time: "morning" }),
      supp({ id: "c", category: "calcium", preferred_time: "morning" }),
    ]);
    for (const { id } of SLOT_ORDER) {
      const categories = categoriesIn(result, id);
      expect(categories.includes("iron") && categories.includes("calcium")).toBe(false);
    }
    expect(result.warningKeys).toContain("supp.warn.ironCalcium");
  });

  it("moves every clashing item, not just the first one it finds", () => {
    // Two of each. This used to move one calcium, leave the other beside both
    // irons, and still raise the warning — telling the athlete a clash had
    // been separated while it was still sitting there.
    const result = buildSchedule([
      supp({ id: "i1", category: "iron", preferred_time: "morning" }),
      supp({ id: "i2", category: "iron", preferred_time: "morning" }),
      supp({ id: "c1", category: "calcium", preferred_time: "morning" }),
      supp({ id: "c2", category: "calcium", preferred_time: "morning" }),
    ]);
    for (const { id } of SLOT_ORDER) {
      const categories = categoriesIn(result, id);
      expect(
        categories.includes("iron") && categories.includes("calcium"),
        `${id} still holds both: ${categories.join(", ")}`,
      ).toBe(false);
    }
    // All four are still scheduled; separating is not dropping.
    expect(placedCount(result)).toBe(4);
  });

  it("admits when a clash cannot be separated at all", () => {
    // Enough iron to reach every slot. There is nowhere left to move calcium
    // to, and moving it anyway would only recreate the clash elsewhere.
    const irons = SLOT_ORDER.map(({ id }, index) =>
      supp({ id: `i${index}`, category: "iron", times_per_day: 6 }),
    );
    const result = buildSchedule([...irons, supp({ id: "c", category: "calcium" })]);
    const admitted =
      result.warningKeys.includes("supp.warn.cannotSeparate") ||
      SLOT_ORDER.every(({ id }) => {
        const categories = categoriesIn(result, id);
        return !(categories.includes("iron") && categories.includes("calcium"));
      });
    expect(admitted).toBe(true);
    // Whatever happened, the calcium was not silently thrown away.
    expect(
      result.slots.some((slot) =>
        slot.items.some((item) => item.supplement.category === "calcium"),
      ),
    ).toBe(true);
  });

  it("warns when a caffeinated pre-workout lands late in the day", () => {
    const result = buildSchedule([
      supp({ id: "p", category: "preworkout", preferred_time: "bedtime" }),
    ]);
    expect(result.warningKeys).toContain("supp.warn.caffeineLate");
  });
});
