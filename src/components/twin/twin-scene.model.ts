import type { TwinSnapshot, TwinRegionRecoveryBand } from "@/lib/digital-twin.schema";
import { mapTwinSnapshotToVisualState } from "@/lib/digital-twin.visual-state";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";

/** Geometry can be detailed; evidence cannot be more granular than the source. */
export const TWIN_BODY_REGIONS = [
  "chest", "back", "shoulders", "arms", "legs", "glutes", "core", "abs",
] as const satisfies readonly (typeof KNOWN_MUSCLE_GROUPS)[number][];
export type TwinBodyRegion = (typeof TWIN_BODY_REGIONS)[number];
export const isTwinBodyRegion = (value: string): value is TwinBodyRegion =>
  TWIN_BODY_REGIONS.some((region) => region === value);

export type TwinSceneRegion = {
  id: TwinBodyRegion;
  band: TwinRegionRecoveryBand;
  recoveryPct: number | null;
  emphasis: number;
};
export type TwinSceneState = {
  layer: "recovery";
  dataAvailable: boolean;
  regions: TwinSceneRegion[];
};

/** No new physiological calculation: bands come from the canonical snapshot. */
export function mapTwinScene(snapshot: TwinSnapshot): TwinSceneState {
  const visual = mapTwinSnapshotToVisualState(snapshot);
  return {
    layer: "recovery",
    dataAvailable: snapshot.dataAvailable,
    regions: TWIN_BODY_REGIONS.map((id) => {
      const source = snapshot.regions.find((region) => region.region === id);
      const known = source?.provenance === "calculated" &&
        source.recoveryBand !== "unknown" && source.recoveryPct !== null &&
        Number.isFinite(source.recoveryPct) && source.recoveryPct >= 0 && source.recoveryPct <= 100;
      return {
        id,
        band: known ? source.recoveryBand : "unknown",
        recoveryPct: known ? source.recoveryPct : null,
        emphasis: known ? (visual.regions.find((region) => region.region === id)?.emphasis ?? 0) : 0,
      };
    }),
  };
}

export type TwinCameraCommand =
  | "front" | "back" | "left" | "right" | "rotate-left" | "rotate-right"
  | "zoom-in" | "zoom-out" | "reset";
export type TwinCameraPose = { yaw: number; pitch: number; distance: number };
export const TWIN_CAMERA = {
  minPitch: Math.PI * 0.37,
  maxPitch: Math.PI * 0.58,
  defaultPitch: Math.PI * 0.48,
  minDistanceRatio: 0.58,
  maxDistanceRatio: 1.35,
  step: Math.PI / 8,
} as const;

export function fittedTwinDistance(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 0.7;
  const tangent = Math.tan((35 * Math.PI) / 360);
  return Math.max(1.95 / (2 * tangent), 1.08 / (2 * tangent * safeAspect)) * 1.12;
}

export function moveTwinCamera(
  pose: TwinCameraPose, command: TwinCameraCommand, fitDistance: number,
): TwinCameraPose {
  const fit = Number.isFinite(fitDistance) && fitDistance > 0 ? fitDistance : fittedTwinDistance(0.7);
  const next = {
    yaw: Number.isFinite(pose.yaw) ? pose.yaw : 0,
    pitch: Number.isFinite(pose.pitch) ? pose.pitch : TWIN_CAMERA.defaultPitch,
    distance: Number.isFinite(pose.distance) ? pose.distance : fit,
  };
  if (command === "front") next.yaw = 0;
  if (command === "back") next.yaw = Math.PI;
  if (command === "left") next.yaw = -Math.PI / 2;
  if (command === "right") next.yaw = Math.PI / 2;
  if (command === "rotate-left") next.yaw -= TWIN_CAMERA.step;
  if (command === "rotate-right") next.yaw += TWIN_CAMERA.step;
  if (command === "zoom-in") next.distance *= 0.88;
  if (command === "zoom-out") next.distance /= 0.88;
  if (command === "reset") {
    next.yaw = 0;
    next.pitch = TWIN_CAMERA.defaultPitch;
    next.distance = fit;
  }
  // Do not clamp yaw: orbit must remain continuous across repeated full turns.
  next.pitch = Math.max(TWIN_CAMERA.minPitch, Math.min(TWIN_CAMERA.maxPitch, next.pitch));
  next.distance = Math.max(fit * TWIN_CAMERA.minDistanceRatio,
    Math.min(fit * TWIN_CAMERA.maxDistanceRatio, next.distance));
  return next;
}

export function isTwinTap(maxTravel: number, multiplePointers: boolean): boolean {
  return Number.isFinite(maxTravel) && maxTravel <= 6 && !multiplePointers;
}

export function shouldAnimateTwin(visible: boolean, reducedMotion: boolean, motionEnabled: boolean): boolean {
  return visible && !reducedMotion && motionEnabled;
}
