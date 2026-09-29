import { describe, expect, it, vi } from "vitest";
import {
  captureShadowPredictionQuietly,
  type ShadowCaptureRecorder,
} from "./shadow-capture.server";

const userId = "11111111-1111-4111-8111-111111111111";

describe("a shadow forecast that could not be captured", () => {
  it("never reaches the athlete's decision", () => {
    // Fail-open is the property that must not change. A decision about
    // somebody's training cannot break because an audit ledger did.
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    return expect(
      captureShadowPredictionQuietly(
        { capture: "workout_completion", userId },
        async () => {
          throw new Error("PERSONAL_MODEL_PREDICTION_WRITE_FAILED");
        },
        record,
      ),
    ).resolves.toBeUndefined();
  });

  it("is written down, which is the half that was missing", async () => {
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    await captureShadowPredictionQuietly(
      { capture: "workout_completion", userId },
      async () => {
        throw new Error("PERSONAL_MODEL_BASELINE_UNAVAILABLE");
      },
      record,
    );
    expect(record).toHaveBeenCalledWith({
      eventName: "shadow_prediction.capture",
      outcome: "failure",
      userId,
      errorCode: "PERSONAL_MODEL_BASELINE_UNAVAILABLE",
      metadata: { capture: "workout_completion" },
    });
  });

  it("keeps the code of a failure that named the rule that refused it", async () => {
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    for (const code of ["PERSONAL_MODEL_PREDICTION_WRITE_FAILED", "SHADOW_LEDGER_UNREADABLE"]) {
      await captureShadowPredictionQuietly(
        { capture: "personal_completion", userId },
        async () => {
          throw new Error(code);
        },
        record,
      );
      expect(record.mock.lastCall?.[0]).toMatchObject({ errorCode: code });
    }
  });

  it("does not paste an unnamed cause into telemetry", async () => {
    // A thrown message can carry provider or database detail, and the
    // observability row is read by whoever opens the dashboard.
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    for (const cause of [
      new Error('relation "personal_model_predictions" does not exist at character 15'),
      new Error(""),
      new TypeError("fetch failed"),
      "a string nobody threw as an Error",
    ]) {
      await captureShadowPredictionQuietly(
        { capture: "personal_completion", userId },
        async () => {
          throw cause;
        },
        record,
      );
      expect(record.mock.lastCall?.[0]).toMatchObject({ errorCode: "SHADOW_CAPTURE_THREW" });
      expect(JSON.stringify(record.mock.lastCall?.[0])).not.toContain("does not exist");
    }
  });

  it("stays silent when the capture simply declined", async () => {
    // Declining is the normal answer — no model artifact yet, no usable
    // baseline, a day already captured. A row for every ordinary day would bury
    // the one that matters.
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    await captureShadowPredictionQuietly(
      { capture: "workout_completion", userId },
      async () => false,
      record,
    );
    await captureShadowPredictionQuietly(
      { capture: "personal_completion", userId },
      async () => undefined,
      record,
    );
    expect(record).not.toHaveBeenCalled();
  });

  it("emits a code the observability schema will accept", async () => {
    // A code the schema rejects fails the whole write, turning a failure that
    // tried to explain itself into one that vanished.
    const record = vi.fn<ShadowCaptureRecorder>(async () => undefined);
    await captureShadowPredictionQuietly(
      { capture: "workout_completion", userId },
      async () => {
        throw new Error("lower case and spaces");
      },
      record,
    );
    expect(record.mock.lastCall?.[0]?.errorCode).toMatch(/^[A-Z][A-Z0-9_]{2,99}$/);
  });
});
