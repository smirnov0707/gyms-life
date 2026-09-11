import { describe, expect, it } from "vitest";
import {
  confirmManualTwinGuideCheckpoint,
  INITIAL_MANUAL_TWIN_GUIDE_STATE,
  manualGuideFramingAssessment,
  manualGuideRotationProgress,
} from "./personalized-twin.manual-guide";

describe("Personalized Twin manual scan guide", () => {
  it("advances only after explicit user confirmations", () => {
    let state = INITIAL_MANUAL_TWIN_GUIDE_STATE;
    expect(state).toMatchObject({ confirmed: 0, progressPct: 0, complete: false, current: "front" });

    state = confirmManualTwinGuideCheckpoint(state);
    expect(state).toMatchObject({ confirmed: 1, progressPct: 20, current: "right" });

    state = confirmManualTwinGuideCheckpoint(state);
    state = confirmManualTwinGuideCheckpoint(state);
    state = confirmManualTwinGuideCheckpoint(state);
    state = confirmManualTwinGuideCheckpoint(state);

    expect(state).toMatchObject({ confirmed: 5, progressPct: 100, complete: true, current: null });
    expect(confirmManualTwinGuideCheckpoint(state)).toEqual(state);
  });

  it("marks manual framing as user-confirmed rather than automatic", () => {
    expect(manualGuideFramingAssessment(false)).toEqual({
      status: "unknown",
      automatic: false,
      bodyHeightRatio: null,
    });
    expect(manualGuideFramingAssessment(true)).toEqual({
      status: "ready",
      automatic: false,
      bodyHeightRatio: null,
    });
  });

  it("maps manual checkpoints into truthful rotation progress", () => {
    const first = confirmManualTwinGuideCheckpoint(INITIAL_MANUAL_TWIN_GUIDE_STATE);
    expect(manualGuideRotationProgress(first)).toMatchObject({
      phase: 1,
      progressPct: 20,
      completeEstimate: false,
    });

    let complete = first;
    for (let index = 0; index < 4; index += 1) complete = confirmManualTwinGuideCheckpoint(complete);
    expect(manualGuideRotationProgress(complete)).toMatchObject({
      phase: 5,
      progressPct: 100,
      completeEstimate: true,
    });
  });
});
