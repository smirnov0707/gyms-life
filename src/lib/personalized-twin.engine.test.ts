import { describe, expect, it } from "vitest";
import { buildPersonalizedTwinPreparation } from "./personalized-twin.engine";

describe("Personalized Twin preparation", () => {
  it("requires front, side and back before reconstruction readiness", () => {
    const state = buildPersonalizedTwinPreparation({
      capturedAngles: ["front", "side"],
      consentGranted: true,
      providerAvailable: true,
    });
    expect(state.status).toBe("collecting");
    expect(state.missingAngles).toEqual(["back"]);
    expect(state.canStartReconstruction).toBe(false);
  });

  it("requires explicit consent even with all three views", () => {
    const state = buildPersonalizedTwinPreparation({
      capturedAngles: ["front", "side", "back"],
      consentGranted: false,
      providerAvailable: true,
    });
    expect(state.status).toBe("awaiting_consent");
    expect(state.canStartReconstruction).toBe(false);
  });

  it("does not pretend a reconstruction provider exists", () => {
    const state = buildPersonalizedTwinPreparation({
      capturedAngles: ["front", "side", "back"],
      consentGranted: true,
      providerAvailable: false,
    });
    expect(state.status).toBe("provider_unavailable");
    expect(state.canStartReconstruction).toBe(false);
    expect(state.medicalScan).toBe(false);
  });
});
