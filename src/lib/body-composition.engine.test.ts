import { describe, expect, it } from "vitest";
import { bmiBodyFat, navyBodyFat } from "./body-composition.engine";

describe("navyBodyFat", () => {
  it("matches the published male worked example", () => {
    // 180 cm, waist 90, neck 38 → 19.81% by the US Navy equation.
    const result = navyBodyFat("male", 180, 90, 38);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(19.81, 2);
  });

  it("matches the published female worked example", () => {
    // 165 cm, waist 75, hips 98, neck 32 → 28.94% by the female equation.
    const result = navyBodyFat("female", 165, 75, 32, 98);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(28.94, 2);
  });

  it("abstains rather than guessing when a required tape reading is missing", () => {
    expect(navyBodyFat("male", 180, 90, undefined)).toBeNull();
    expect(navyBodyFat("male", 180, undefined, 38)).toBeNull();
    // The female equation needs hips as well.
    expect(navyBodyFat("female", 165, 75, 32)).toBeNull();
  });

  it("abstains when the circumferences are physically impossible", () => {
    // A neck wider than the waist makes the logarithm's argument non-positive.
    expect(navyBodyFat("male", 180, 38, 90)).toBeNull();
  });
});

describe("bmiBodyFat", () => {
  it("applies the Deurenberg equation for a known age", () => {
    // 180 cm, 80 kg → BMI 24.69; 1.2*24.69 + 0.23*30 - 10.8 - 5.4 = 20.3%.
    const result = bmiBodyFat("male", 180, 80, 30);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(20.33, 2);
  });

  it("separates ages by the term the equation actually carries", () => {
    const young = bmiBodyFat("male", 180, 80, 20);
    const older = bmiBodyFat("male", 180, 80, 50);
    expect(older! - young!).toBeCloseTo(6.9, 5);
  });

  it("abstains on an unknown age instead of assuming thirty", () => {
    // The regression this pins: a missing age used to default to 30, which
    // put a fabricated 20.3% into a blend the athlete reads as measured.
    expect(bmiBodyFat("male", 180, 80, undefined)).toBeNull();
  });

  it("abstains when weight was never recorded", () => {
    expect(bmiBodyFat("male", 180, undefined, 30)).toBeNull();
  });
});
