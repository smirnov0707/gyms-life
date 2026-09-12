import type { TwinFramingAssessment } from "./personalized-twin.framing";
import type { TwinRotationProgress } from "./personalized-twin.rotation-progress";

export type ManualTwinGuideCheckpoint = "front" | "right" | "back" | "left" | "front_complete";

export const MANUAL_TWIN_GUIDE_CHECKPOINTS: readonly ManualTwinGuideCheckpoint[] = [
  "front",
  "right",
  "back",
  "left",
  "front_complete",
];

export type ManualTwinGuideState = {
  confirmed: number;
  progressPct: number;
  complete: boolean;
  current: ManualTwinGuideCheckpoint | null;
};

export const INITIAL_MANUAL_TWIN_GUIDE_STATE: ManualTwinGuideState = {
  confirmed: 0,
  progressPct: 0,
  complete: false,
  current: "front",
};

function checkpointAt(index: number): ManualTwinGuideCheckpoint | null {
  return MANUAL_TWIN_GUIDE_CHECKPOINTS[index] ?? null;
}

function phaseForConfirmed(confirmed: number): TwinRotationProgress["phase"] {
  if (confirmed <= 0) return 0;
  if (confirmed === 1) return 1;
  if (confirmed === 2) return 2;
  if (confirmed === 3) return 3;
  if (confirmed === 4) return 4;
  return 5;
}

export function confirmManualTwinGuideCheckpoint(
  state: ManualTwinGuideState,
): ManualTwinGuideState {
  if (state.complete) return state;

  const confirmed = Math.min(MANUAL_TWIN_GUIDE_CHECKPOINTS.length, state.confirmed + 1);
  const complete = confirmed === MANUAL_TWIN_GUIDE_CHECKPOINTS.length;
  const progressPct = Math.round((confirmed / MANUAL_TWIN_GUIDE_CHECKPOINTS.length) * 100);

  return {
    confirmed,
    progressPct,
    complete,
    current: complete ? null : checkpointAt(confirmed),
  };
}

export function manualGuideFramingAssessment(confirmed: boolean): TwinFramingAssessment {
  return {
    status: confirmed ? "ready" : "unknown",
    automatic: false,
    bodyHeightRatio: null,
  };
}

export function manualGuideRotationProgress(state: ManualTwinGuideState): TwinRotationProgress {
  return {
    phase: phaseForConfirmed(state.confirmed),
    stableFrames: 0,
    progressPct: state.progressPct,
    completeEstimate: state.complete,
  };
}
