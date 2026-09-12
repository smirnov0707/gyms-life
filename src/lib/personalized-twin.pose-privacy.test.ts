import { describe, expect, it } from "vitest";
import {
  createWhenPosePrivacyAllows,
  personalizedTwinPosePrivacyGate,
} from "./personalized-twin.pose-privacy";

describe("Personalized Twin pose privacy gate", () => {
  it("keeps external-metrics pose runtime fail-closed", () => {
    expect(personalizedTwinPosePrivacyGate()).toEqual({
      allowed: false,
      reason: "metrics_review_required",
    });
  });

  it("does not invoke the detector factory while metrics review is blocked", async () => {
    let calls = 0;
    const result = await createWhenPosePrivacyAllows(
      personalizedTwinPosePrivacyGate(),
      async () => {
        calls += 1;
        return { detector: true };
      },
    );
    expect(result).toBeNull();
    expect(calls).toBe(0);
  });
});
