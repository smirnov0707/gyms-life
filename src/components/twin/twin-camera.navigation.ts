import type { Ray, Vector3 } from "three";
import { TWIN_FRAME, type TwinCameraCommand } from "./twin-scene.model";

/** Fractions of the loaded graphic mesh height, not athlete measurements. */
export const TWIN_NAVIGATION = {
  minHeight: 0.08,
  maxHeight: 0.94,
  panStep: 0.1,
  upperHeight: 0.73,
  lowerHeight: 0.28,
  upperDistanceRatio: 0.62,
  lowerDistanceRatio: 0.7,
} as const;

function frame(height: number, homeY: number) {
  const h = Number.isFinite(height) && height > 0 ? height : TWIN_FRAME.height;
  const home = Number.isFinite(homeY) ? homeY : TWIN_FRAME.eyeHeight;
  return { height: h, home, floor: home - h * (TWIN_FRAME.eyeHeight / TWIN_FRAME.height) };
}

export function clampTwinTargetY(value: number, height: number, homeY: number): number {
  const f = frame(height, homeY);
  const y = Number.isFinite(value) ? value : f.home;
  return Math.max(
    f.floor + f.height * TWIN_NAVIGATION.minHeight,
    Math.min(f.floor + f.height * TWIN_NAVIGATION.maxHeight, y),
  );
}

export function moveTwinTargetY(
  current: number,
  action: TwinCameraCommand,
  height: number,
  homeY: number,
): number {
  const f = frame(height, homeY);
  let y = Number.isFinite(current) ? current : f.home;
  if (action === "pan-up") y += f.height * TWIN_NAVIGATION.panStep;
  if (action === "pan-down") y -= f.height * TWIN_NAVIGATION.panStep;
  if (action === "upper-body") y = f.floor + f.height * TWIN_NAVIGATION.upperHeight;
  if (action === "lower-body") y = f.floor + f.height * TWIN_NAVIGATION.lowerHeight;
  if (action === "reset") y = f.home;
  return clampTwinTargetY(y, f.height, f.home);
}

/** Keep the near-side picking plane on the body axis, including at a tilted camera. */
export function twinNearSideReach(ray: Ray, camera: Vector3, axis: Vector3): number {
  const nx = camera.x - axis.x;
  const nz = camera.z - axis.z;
  const length = Math.hypot(nx, nz);
  if (!Number.isFinite(length) || length < 1e-8) return 0;
  const denominator = (ray.direction.x * nx + ray.direction.z * nz) / length;
  if (!Number.isFinite(denominator) || denominator >= -1e-8) return 0;
  const distance =
    ((axis.x - ray.origin.x) * nx + (axis.z - ray.origin.z) * nz) / (length * denominator);
  return Number.isFinite(distance) && distance > 0 ? distance : 0;
}

export function twinCameraKey(
  event: Pick<
    KeyboardEvent,
    "key" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "isComposing" | "defaultPrevented"
  >,
): TwinCameraCommand | undefined {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey)
    return undefined;
  if (event.key === "ArrowUp") return event.shiftKey ? "tilt-up" : "pan-up";
  if (event.key === "ArrowDown") return event.shiftKey ? "tilt-down" : "pan-down";
  const keys: Record<string, TwinCameraCommand> = {
    ArrowLeft: "rotate-left",
    ArrowRight: "rotate-right",
    "+": "zoom-in",
    "=": "zoom-in",
    "-": "zoom-out",
    Home: "reset",
  };
  return keys[event.key];
}

export function twinPresetDistance(action: TwinCameraCommand, fit: number): number | undefined {
  if (action === "upper-body") return fit * TWIN_NAVIGATION.upperDistanceRatio;
  if (action === "lower-body") return fit * TWIN_NAVIGATION.lowerDistanceRatio;
  return undefined;
}
