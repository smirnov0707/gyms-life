import { describe, expect, it } from "vitest";
import {
  AvailableWorkoutEquipmentSchema,
  canonicalWorkoutEquipment,
} from "./workout-equipment.schema";

describe("workout equipment contracts", () => {
  it("normalizes known aliases into the canonical catalog vocabulary", () => {
    expect(canonicalWorkoutEquipment("resistance bands")).toBe("band");
    expect(canonicalWorkoutEquipment("pull-up bar")).toBe("pullup_bar");
    expect(canonicalWorkoutEquipment("dumbbells")).toBe("dumbbell");
  });

  it("does not accept unknown or duplicate equipment in a current-state context", () => {
    expect(AvailableWorkoutEquipmentSchema.safeParse(["invented-device"]).success).toBe(false);
    expect(AvailableWorkoutEquipmentSchema.safeParse(["bands", "band"]).success).toBe(false);
  });
});
