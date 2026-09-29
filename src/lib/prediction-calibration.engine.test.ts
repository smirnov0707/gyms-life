import { describe, expect, it } from "vitest";
import { AthletePredictionSchema } from "./prediction.schema";
import {
  buildPredictionCalibration,
  calibrationMaturityPercent,
} from "./prediction-calibration.engine";
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

describe("shadow model maturity", () => {
  const at = (totalEvaluated: number, minimumEvaluated: number) => ({
    totalEvaluated,
    minimumEvaluated,
  });

  it("is the share of the minimum that has been evaluated", () => {
    expect(calibrationMaturityPercent(at(4, 8))).toBe(50);
    expect(calibrationMaturityPercent(at(0, 8))).toBe(0);
  });

  it("does not run past a hundred once the minimum is met", () => {
    expect(calibrationMaturityPercent(at(20, 8))).toBe(100);
  });

  it("is unknown rather than zero when nothing was read", () => {
    // The failure this exists for: a still-running or failed query drew an
    // empty ring reading "0%", which is a claim that the model has been
    // checked against nothing rather than an admission that nobody looked.
    expect(calibrationMaturityPercent(null)).toBeNull();
    expect(calibrationMaturityPercent(undefined)).toBeNull();
  });

  it("is unknown when the minimum could make the arithmetic lie", () => {
    // Dividing by zero would report every athlete instantly mature.
    expect(calibrationMaturityPercent(at(3, 0))).toBeNull();
    expect(calibrationMaturityPercent(at(3, -1))).toBeNull();
    expect(calibrationMaturityPercent(at(Number.NaN, 8))).toBeNull();
  });
});

describe("a forecast that never varied", () => {
  const day = (index: number) => `2026-09-${String(index + 1).padStart(2, "0")}`;

  it("is not scored, however many outcomes it accumulates", () => {
    // Exactly what production holds: the shadow model answered
    // `probability: 0` every time, and every observed outcome was `false`.
    // Brier works out to 0.000 and the calibration gap to 0 — the best values
    // either can take — for a model that has never made a distinction. The
    // panel prints that under "0 means perfectly scored probability forecasts".
    const constant = Array.from({ length: 12 }, (_, index) =>
      prediction({ id: index, day: day(index), probability: 0, actual: false }),
    );
    const [model] = buildPredictionCalibration(constant).models;

    expect(model?.evaluated).toBe(12);
    expect(model?.evaluated).toBeGreaterThanOrEqual(MINIMUM_EVALUATED_PREDICTIONS_FOR_CALIBRATION);
    expect(model?.brierScore).toBeNull();
    expect(model?.calibrationGap).toBeNull();
    expect(model?.metricsWithheldBecause).toBe("constant_forecast");
  });

  it("is still counted, because the evidence is real even when the score is not", () => {
    const constant = Array.from({ length: 12 }, (_, index) =>
      prediction({ id: index, day: day(index), probability: 0, actual: false }),
    );
    const report = buildPredictionCalibration(constant);
    expect(report.totalEvaluated).toBe(12);
    expect(report.totalPending).toBe(0);
  });

  it("withholds a score when the outcome never varied either", () => {
    // A varying forecast against an unchanging world. Predicting the constant
    // scores perfectly and says nothing about the forecast.
    const varied = Array.from({ length: 12 }, (_, index) =>
      prediction({
        id: index,
        day: day(index),
        probability: index % 2 === 0 ? 0.2 : 0.8,
        actual: false,
      }),
    );
    const [model] = buildPredictionCalibration(varied).models;
    expect(model?.metricsWithheldBecause).toBe("constant_outcome");
    expect(model?.brierScore).toBeNull();
  });

  it("scores a model that actually moved against a world that actually varied", () => {
    // The case the metrics were written for must keep working.
    const real = Array.from({ length: 12 }, (_, index) =>
      prediction({
        id: index,
        day: day(index),
        probability: index % 3 === 0 ? 0.3 : 0.7,
        actual: index % 2 === 0,
      }),
    );
    const [model] = buildPredictionCalibration(real).models;
    expect(model?.metricsWithheldBecause).toBe("none");
    expect(model?.brierScore).not.toBeNull();
    expect(model?.calibrationGap).not.toBeNull();
  });
});
