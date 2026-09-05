import type { TwinSnapshot, TwinRegionRecoveryBand } from "@/lib/digital-twin.schema";
import { mapTwinSnapshotToVisualState } from "@/lib/digital-twin.visual-state";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";

/** Geometry can be detailed; evidence cannot be more granular than the source. */
export const TWIN_BODY_REGIONS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "glutes",
  "core",
  "abs",
] as const satisfies readonly (typeof KNOWN_MUSCLE_GROUPS)[number][];
export type TwinBodyRegion = (typeof TWIN_BODY_REGIONS)[number];
export const isTwinBodyRegion = (value: string): value is TwinBodyRegion =>
  TWIN_BODY_REGIONS.some((region) => region === value);

export const TWIN_LAYERS = ["recovery", "logged_volume"] as const;
export type TwinLayer = (typeof TWIN_LAYERS)[number];
export type TwinDisplayTone =
  TwinRegionRecoveryBand | "volume_low" | "volume_medium" | "volume_high";
export const TWIN_DISPLAY_COLORS: Record<TwinDisplayTone, string> = {
  fresh: "#438c7a",
  moderate: "#a58b55",
  fatigued: "#a65e6c",
  unknown: "#566068",
  volume_low: "#49657c",
  volume_medium: "#659fc3",
  volume_high: "#9bd4ee",
};

/** Existing 2D renderer tones, sharing the same semantic layer vocabulary. */
export function twinDisplayToneFor2D(tone: TwinDisplayTone) {
  if (tone === "fresh") return "cool";
  if (tone === "moderate") return "warm";
  if (tone === "fatigued") return "hot";
  if (tone === "unknown") return "muted";
  return tone;
}

export type TwinRegionDisplay = { value: number | null; tone: TwinDisplayTone };

/**
 * A presentation projection of existing facts, not another load/recovery model.
 * Volume is sum(weight × reps). Relative thirds are only a visual legend within
 * this snapshot, NOT thresholds for stimulus, effort, injury or recovery.
 */
export function getTwinRegionDisplay(
  snapshot: TwinSnapshot,
  id: string,
  layer: TwinLayer,
): TwinRegionDisplay {
  const unknown: TwinRegionDisplay = { value: null, tone: "unknown" };
  if (!snapshot.dataAvailable) return unknown;
  const source = snapshot.regions.find((region) => region.region === id);
  if (!source || source.provenance !== "calculated") return unknown;
  if (layer === "recovery") {
    return source.recoveryBand !== "unknown" &&
      source.recoveryPct !== null &&
      Number.isFinite(source.recoveryPct) &&
      source.recoveryPct >= 0 &&
      source.recoveryPct <= 100
      ? { value: source.recoveryPct, tone: source.recoveryBand }
      : unknown;
  }
  if (
    layer !== "logged_volume" ||
    source.volumeKg === null ||
    !Number.isFinite(source.volumeKg) ||
    source.volumeKg < 0
  )
    return unknown;
  const maxVolume = snapshot.regions.reduce(
    (max, region) =>
      region.provenance === "calculated" &&
      region.volumeKg !== null &&
      Number.isFinite(region.volumeKg) &&
      region.volumeKg >= 0
        ? Math.max(max, region.volumeKg)
        : max,
    0,
  );
  const fraction = maxVolume > 0 ? source.volumeKg / maxVolume : 0;
  return {
    value: source.volumeKg,
    tone: fraction <= 1 / 3 ? "volume_low" : fraction <= 2 / 3 ? "volume_medium" : "volume_high",
  };
}

export type TwinSceneRegion = {
  id: TwinBodyRegion;
  band: TwinRegionRecoveryBand;
  recoveryPct: number | null;
  emphasis: number;
  display: TwinRegionDisplay;
};
export type TwinSceneState = {
  layer: TwinLayer;
  dataAvailable: boolean;
  regions: TwinSceneRegion[];
};

/** No new physiological calculation: both values come from the canonical snapshot. */
export function mapTwinScene(
  snapshot: TwinSnapshot,
  layer: TwinLayer = "recovery",
): TwinSceneState {
  const visual = mapTwinSnapshotToVisualState(snapshot);
  return {
    layer,
    dataAvailable: snapshot.dataAvailable,
    regions: TWIN_BODY_REGIONS.map((id) => {
      const recovery = getTwinRegionDisplay(snapshot, id, "recovery");
      return {
        id,
        band:
          recovery.tone === "fresh" || recovery.tone === "moderate" || recovery.tone === "fatigued"
            ? recovery.tone
            : "unknown",
        recoveryPct: recovery.value,
        emphasis:
          recovery.value !== null
            ? (visual.regions.find((region) => region.region === id)?.emphasis ?? 0)
            : 0,
        display: getTwinRegionDisplay(snapshot, id, layer),
      };
    }),
  };
}

export type TwinCameraCommand =
  | "front"
  | "back"
  | "left"
  | "right"
  | "rotate-left"
  | "rotate-right"
  | "zoom-in"
  | "zoom-out"
  | "reset";
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
  pose: TwinCameraPose,
  command: TwinCameraCommand,
  fitDistance: number,
): TwinCameraPose {
  const fit =
    Number.isFinite(fitDistance) && fitDistance > 0 ? fitDistance : fittedTwinDistance(0.7);
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
  next.distance = Math.max(
    fit * TWIN_CAMERA.minDistanceRatio,
    Math.min(fit * TWIN_CAMERA.maxDistanceRatio, next.distance),
  );
  return next;
}

export function isTwinTap(maxTravel: number, multiplePointers: boolean): boolean {
  return Number.isFinite(maxTravel) && maxTravel <= 6 && !multiplePointers;
}

export function shouldAnimateTwin(
  visible: boolean,
  reducedMotion: boolean,
  motionEnabled: boolean,
): boolean {
  return visible && !reducedMotion && motionEnabled;
}
