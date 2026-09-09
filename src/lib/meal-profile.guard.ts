/** Required inputs for the existing body-based energy prompt. Never substitute a default body. */
export function hasMealCalculationInputs(body: {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
}): boolean {
  return (
    body.age !== null &&
    Number.isFinite(body.age) &&
    body.age > 0 &&
    body.heightCm !== null &&
    Number.isFinite(body.heightCm) &&
    body.heightCm > 0 &&
    body.weightKg !== null &&
    Number.isFinite(body.weightKg) &&
    body.weightKg > 0 &&
    (body.gender === "male" || body.gender === "female")
  );
}
