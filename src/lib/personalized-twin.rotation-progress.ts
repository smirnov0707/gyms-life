export type TwinRotationProgress = {
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  stableFrames: number;
  progressPct: number;
  completeEstimate: boolean;
};

export const INITIAL_TWIN_ROTATION_PROGRESS: TwinRotationProgress = {
  phase: 0,
  stableFrames: 0,
  progressPct: 0,
  completeEstimate: false,
};

const REQUIRED_STABLE_FRAMES = 5;

type SilhouetteBand = "wide" | "narrow" | "middle" | "unknown";

function bandFor(ratio: number | null): SilhouetteBand {
  if (ratio === null || !Number.isFinite(ratio)) return "unknown";
  if (ratio >= 0.42) return "wide";
  if (ratio <= 0.28) return "narrow";
  return "middle";
}
const EXPECTED_BANDS: readonly SilhouetteBand[] = ["wide", "narrow", "wide", "narrow", "wide"];

export function updateTwinRotationProgress(
  state: TwinRotationProgress,
  input: { framingReady: boolean; shoulderSpanRatio: number | null },
): TwinRotationProgress {
  if (state.completeEstimate) return state;
  if (!input.framingReady) return { ...state, stableFrames: 0 };

  const observed = bandFor(input.shoulderSpanRatio);
  const expected = EXPECTED_BANDS[state.phase] ?? "wide";
  if (observed !== expected) return { ...state, stableFrames: 0 };

  const stableFrames = state.stableFrames + 1;
  if (stableFrames < REQUIRED_STABLE_FRAMES) return { ...state, stableFrames };

  const nextPhase = Math.min(5, state.phase + 1) as TwinRotationProgress["phase"];
  const progressPct = Math.round((nextPhase / 5) * 100);
  return {
    phase: nextPhase,
    stableFrames: 0,
    progressPct,
    completeEstimate: nextPhase === 5,
  };
}
