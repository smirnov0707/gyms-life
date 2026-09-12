import { describe, expect, it } from "vitest";
import { assertPersonalizedTwinTransition } from "./personalized-twin.lifecycle";

describe("Personalized Twin lifecycle", () => {
  it("allows only forward/idempotent state transitions", () => {
    expect(() =>
      assertPersonalizedTwinTransition({ from: "collecting", to: "ready_for_provider" }),
    ).not.toThrow();
    expect(() =>
      assertPersonalizedTwinTransition({ from: "processing", to: "ready_for_provider" }),
    ).toThrow("PERSONALIZED_TWIN_INVALID_TRANSITION");
  });

  it("does not allow ready before raw input cleanup and model persistence", () => {
    expect(() => assertPersonalizedTwinTransition({ from: "processing", to: "ready" })).toThrow(
      "PERSONALIZED_TWIN_INPUT_CLEANUP_REQUIRED",
    );
    expect(() =>
      assertPersonalizedTwinTransition({
        from: "processing",
        to: "ready",
        inputDeletedAt: "2026-09-11T06:00:00.000Z",
      }),
    ).toThrow("PERSONALIZED_TWIN_MODEL_REQUIRED");
  });

  it("requires cleanup and an error code before failed becomes terminal", () => {
    expect(() => assertPersonalizedTwinTransition({ from: "processing", to: "failed" })).toThrow(
      "PERSONALIZED_TWIN_INPUT_CLEANUP_REQUIRED",
    );
    expect(() =>
      assertPersonalizedTwinTransition({
        from: "processing",
        to: "failed",
        inputDeletedAt: "2026-09-11T06:00:00.000Z",
      }),
    ).toThrow("PERSONALIZED_TWIN_ERROR_CODE_REQUIRED");
  });
});
