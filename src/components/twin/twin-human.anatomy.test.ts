import { describe, expect, it } from "vitest";
import {
  ABS_FLOOR_V,
  ABS_HALF_WIDTH_U,
  CHEST_FLOOR_V,
  FRONT_TORSO_REGIONS,
  STERNUM_HALF_WIDTH_U,
  frontTorsoMuscle,
} from "../../../scripts/twin-human-anatomy.mjs";

/**
 * The rule that cuts the front torso along the muscles instead of along the
 * spine's bone segments. It decided the shape of the lit region on the
 * figure, so the properties worth pinning are the ones a wrong boundary would
 * show as: a chest that runs down to the navel, a chest with no breastbone
 * between its halves, or a flat horizontal hem across the ribs.
 *
 * u runs -1 to 1 across the torso, v runs 0 to 1 up the front of it.
 */

describe("frontTorsoMuscle", () => {
  it("puts the pectorals on the upper chest, not across the whole ribcage", () => {
    // Mid-pec, off to one side of the breastbone.
    expect(frontTorsoMuscle(0.5, 0.85)).toBe("chest");
    // The old cut called this chest too; it is the upper abdomen.
    expect(frontTorsoMuscle(0.5, 0.5)).not.toBe("chest");
  });

  it("leaves a breastbone between the two halves", () => {
    // The groove down the sternum is what makes a lit region read as muscle
    // rather than as a garment. Nothing is claimed about the bone itself.
    expect(frontTorsoMuscle(0, 0.9)).toBeNull();
    expect(frontTorsoMuscle(STERNUM_HALF_WIDTH_U / 2, 0.9)).toBeNull();
    expect(frontTorsoMuscle(STERNUM_HALF_WIDTH_U + 0.05, 0.9)).toBe("chest");
  });

  it("is symmetrical across the midline", () => {
    for (const v of [0.2, 0.5, 0.7, 0.9]) {
      for (const u of [0.05, 0.3, 0.6, 0.95]) {
        expect(frontTorsoMuscle(-u, v)).toBe(frontTorsoMuscle(u, v));
      }
    }
  });

  it("runs the pec's lower border upward toward the armpit", () => {
    // A flat cut across the ribs is exactly what read as a hem, so the border
    // has to sit lower near the sternum than out by the arm. Measured rather
    // than assumed: the lowest height at which each column becomes chest.
    const lowestChestAt = (u: number) => {
      for (let v = 0; v <= 1; v += 0.005) {
        if (frontTorsoMuscle(u, v) === "chest") return v;
      }
      return Number.POSITIVE_INFINITY;
    };
    const nearSternum = lowestChestAt(STERNUM_HALF_WIDTH_U + 0.05);
    const nearArmpit = lowestChestAt(0.95);
    expect(nearSternum).toBeLessThan(nearArmpit);
    // And the whole border sits in the upper half of the front torso, not
    // down among the abdominals.
    expect(nearSternum).toBeGreaterThan(CHEST_FLOOR_V);
  });

  it("keeps the abdominals to a central column", () => {
    const midAbs = (ABS_FLOOR_V + CHEST_FLOOR_V) / 2;
    expect(frontTorsoMuscle(0.2, midAbs)).toBe("abs");
    // Out beyond the rectus is flank, which the app files under core.
    expect(frontTorsoMuscle(ABS_HALF_WIDTH_U + 0.2, midAbs)).toBe("core");
  });

  it("gives the lower belly to core", () => {
    expect(frontTorsoMuscle(0.1, ABS_FLOOR_V - 0.1)).toBe("core");
    expect(frontTorsoMuscle(0.8, 0.05)).toBe("core");
  });

  it("only ever answers with a region the app knows, or nothing", () => {
    for (let u = -1; u <= 1; u += 0.05) {
      for (let v = 0; v <= 1; v += 0.05) {
        const region = frontTorsoMuscle(u, v);
        if (region !== null) expect(FRONT_TORSO_REGIONS).toContain(region);
      }
    }
  });

  it("refuses a coordinate that is not one", () => {
    expect(frontTorsoMuscle(Number.NaN, 0.5)).toBeNull();
    expect(frontTorsoMuscle(0.5, Number.NaN)).toBeNull();
  });
});
