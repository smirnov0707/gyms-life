/**
 * The two clinical body-fat formulas the photo scan reconciles against its
 * own visual estimate. Pure, so they can be tested against published
 * worked examples rather than trusted.
 *
 * Both return null rather than a number whenever an input they need is
 * missing. That is the whole contract: the scan blends whatever methods
 * returned a value and reports a confidence beside the result, so a method
 * that declines simply drops out of the blend. A method that guesses
 * instead would move the reported body fat and the confidence with it.
 */

export type BodyScanSex = "male" | "female" | "unknown";

/**
 * US Navy circumference method — the clinical standard for tape-based body
 * fat. Needs neck and waist; the female equation also needs hips.
 */
export function navyBodyFat(
  sex: BodyScanSex,
  heightCm: number,
  waistCm?: number,
  neckCm?: number,
  hipsCm?: number,
): number | null {
  if (!waistCm || !neckCm) return null;
  const log10 = Math.log10;
  if (sex === "female") {
    if (!hipsCm) return null;
    const inner = waistCm + hipsCm - neckCm;
    if (inner <= 0) return null;
    const bf = 495 / (1.29579 - 0.35004 * log10(inner) + 0.221 * log10(heightCm)) - 450;
    return Number.isFinite(bf) ? bf : null;
  }
  const inner = waistCm - neckCm;
  if (inner <= 0) return null;
  const bf = 495 / (1.0324 - 0.19077 * log10(inner) + 0.15456 * log10(heightCm)) - 450;
  return Number.isFinite(bf) ? bf : null;
}

/**
 * Deurenberg BMI equation — an independent cross-check when weight is known.
 *
 * Age is not optional to this equation: the `0.23 * age` term separates a
 * twenty-year-old from a fifty-year-old by 6.9 points of body fat. This used
 * to default a missing age to 30, which quietly moved the blended result by
 * several points for anyone outside their thirties and did it behind a
 * confidence score. Unknown age now means this method abstains.
 */
export function bmiBodyFat(
  sex: BodyScanSex,
  heightCm: number,
  weightKg?: number,
  age?: number,
): number | null {
  if (!weightKg || age === undefined) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const sexFactor = sex === "female" ? 0 : sex === "male" ? 1 : 0.5;
  const bf = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return Number.isFinite(bf) ? bf : null;
}
