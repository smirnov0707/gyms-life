import { describe, expect, it } from "vitest";
import { AthletePredictionSchema } from "./prediction.schema";
import { buildPredictionCalibration } from "./prediction-calibration.engine";
import { MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION } from "./prediction-calibration.schema";

function prediction(input: {
  id: number;
  day: string;
  probability?: number;
  actual?: boolean | null;
  modelVersion?: string;
  maturity?: "shadow" | "canary" | "production";
  generatedHour?: number;
}) {
  const generatedHour = input.generatedHour ?? 8;
  const dayAfter = new Date(`${input.day}T00:00:00.000Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const generatedAt = `${input.day}T${String(generatedHour).padStart(2, "0")}:00:00.000Z`;
  const actual = input.actual ?? null;

  return {
    decisionOn: input.day,
    prediction: AthletePredictionSchema.parse({
      id: `00000000-0000-4000-8000-${String(input.id).padStart(12, "0")}`,
      target: "workout_completion",
      generatedAt,
      horizonEndsAt: dayAfter.toISOString(),
      modelId: "workout-completion-usual-day-baseline",
      modelVersion: input.modelVersion ?? "0.1.0",
      maturity: input.maturity ?? "shadow",
      athleteStateSnapshotId: null,
      evidenceLevel: "moderate",
      evidence: [],
      predicted: { kind: "probability", value: input.probability ?? 0.75 },
      actual: actual === null ? null : { kind: "boolean", value: actual },
      evaluatedAt: actual === null ? null : `${input.day}T20:00:00.000Z`,
    }),
  };
}

function day(index: number): string {
  return `2026-08-${String(index + 1).padStart(2, "0")}`;
}

describe("buildPredictionCalibration", () => {
  it("withholds numerical calibration below the evaluated evidence threshold", () => {
    const candidates = Array.from(
      { length: MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION - 1 },
      (_, index) => prediction({ id: index + 1, day: day(index), actual: index % 2 === 0 }),
    );

    const report = buildPredictionCalibration(candidates);
    const model = report.models[0];

    expect(model?.evaluated).toBe(MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION - 1);
    expect(model?.meanPredictedProbability).toBeNull();
    expect(model?.observedCompletionRate).toBeNull();
    expect(model?.calibrationGap).toBeNull();
    expect(model?.brierScore).toBeNull();
  });

  it("computes Brier score and calibration only from evaluated outcomes", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      prediction({
        id: index + 1,
        day: day(index),
        probability: index % 2 === 0 ? 0.8 : 0.2,
        actual: index % 2 === 0,
      }),
    );
    candidates.push(prediction({ id: 20, day: "2026-08-20", probability: 0.99, actual: null }));

    const report = buildPredictionCalibration(candidates);
    const model = report.models[0];

    expect(model).toMatchObject({ captured: 9, evaluated: 8, pending: 1 });
    expect(model?.meanPredictedProbability).toBe(0.5);
    expect(model?.observedCompletionRate).toBe(0.5);
    expect(model?.calibrationGap).toBe(0);
    expect(model?.brierScore).toBe(0.04);
  });

  it("never treats a pending prediction as a negative outcome", () => {
    const report = buildPredictionCalibration([
      prediction({ id: 1, day: "2026-08-01", probability: 0.9, actual: null }),
    ]);

    expect(report).toMatchObject({ totalCaptured: 1, totalEvaluated: 0, totalPending: 1 });
    expect(report.models[0]?.observedCompletionRate).toBeNull();
  });

  it("uses only the earliest same-day forecast from the same model version", () => {
    const report = buildPredictionCalibration([
      prediction({ id: 1, day: "2026-08-01", probability: 0.2, actual: true, generatedHour: 8 }),
      prediction({ id: 2, day: "2026-08-01", probability: 0.9, actual: true, generatedHour: 12 }),
    ]);

    expect(report.totalCaptured).toBe(1);
    expect(report.totalEvaluated).toBe(1);
  });

  it("keeps model versions in separate calibration groups", () => {
    const report = buildPredictionCalibration([
      prediction({ id: 1, day: "2026-08-01", actual: true, modelVersion: "0.1.0" }),
      prediction({ id: 2, day: "2026-08-02", actual: false, modelVersion: "0.2.0" }),
    ]);

    expect(report.models.map((model) => model.modelVersion)).toEqual(["0.1.0", "0.2.0"]);
    expect(report.models.every((model) => model.captured === 1)).toBe(true);
  });

  it("ignores malformed rows and non-shadow predictions", () => {
    const report = buildPredictionCalibration([
      { decisionOn: "2026-08-01", prediction: { modelId: "broken" } },
      prediction({ id: 2, day: "2026-08-02", actual: true, maturity: "canary" }),
    ]);

    expect(report.totalCaptured).toBe(0);
    expect(report.models).toEqual([]);
  });
});
