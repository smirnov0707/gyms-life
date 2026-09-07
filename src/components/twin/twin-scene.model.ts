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

/**
 * The three questions the figure can answer, each from its own source and
 * never at the same time. Recovery and logged volume come from the athlete's
 * own sets; today's session is read off the programme. One colour cannot say
 * "fatigued" and "on today's list" at once — a region is regularly one and
 * not the other — so they are layers rather than a single painting.
 */
export const TWIN_LAYERS = ["recovery", "logged_volume", "todays_session"] as const;
export type TwinLayer = (typeof TWIN_LAYERS)[number];
export type TwinDisplayTone =
  | TwinRegionRecoveryBand
  | "volume_low"
  | "volume_medium"
  | "volume_high"
  | "in_session"
  | "not_in_session";
export const TWIN_DISPLAY_COLORS: Record<TwinDisplayTone, string> = {
  // The screen's own legend, hue for hue: ready is violet, mid is cyan, and
  // the state that wants attention is amber. They are saturated because the
  // body underneath is a near-black instrument — on skin a strong colour reads
  // as clothing, but on this figure it reads as a lit muscle, which is the
  // whole point of the screen.
  fresh: "#a855f7",
  moderate: "#38bdf8",
  fatigued: "#f97316",
  // The volume layer runs the same violet ramp, low to high, so a glance tells
  // the athlete which end of it a region sits at without reading a number.
  volume_low: "#4f7ce8",
  volume_medium: "#8b5cf6",
  volume_high: "#c026d3",
  // This layer is not a measurement, it is the list of what to do, so it takes
  // the strongest colour on the figure. Everything not on it recedes rather
  // than competing.
  in_session: "#d946ef",
  // The two that mean nothing is being said sit at the body's own colour, so
  // they read as unlit rather than as a state of their own.
  unknown: "#0e1826",
  not_in_session: "#0b1420",
};

/**
 * How strongly each state lights the skin of the region it belongs to, as the
 * light it adds rather than a material setting: the renderer divides by the
 * tone's own brightness, so a pale colour and a dark one at the same number
 * lift the skin by the same amount.
 *
 * Most states are zero on purpose. A region here is a flat plate of triangles
 * with a hard edge, so any colour laid over the whole of it reads as clothing
 * rather than as a body — the pectorals came out looking like a vest. What the
 * athlete needs from the figure is where to look; the exact number for every
 * region is already beside it, ranked, and in the 2D map. So only the states
 * that ask for attention light up, and the rest of the body stays skin.
 */
export const TWIN_TONE_GLOW: Record<TwinDisplayTone, number> = {
  // Read as light cast on the figure, divided by the tone's own brightness in
  // the renderer, so a pale colour and a dark one at the same number lift the
  // surface by the same amount.
  //
  // These sat around a third of where they are now, which was calibrated for a
  // flesh-coloured body: on skin, real brightness turned a region into a
  // garment, so the light had to be held down until the figure was barely
  // marked. The body is a dark instrument again and the constraint is gone —
  // a lit muscle on it reads as a lit muscle, which is what the screen this is
  // drawn from shows and what the athlete asked for twice.
  //
  // Ordered by how much attention the state has earned. A recovered muscle is
  // information too — "what is ready to train" is half of what this figure is
  // for — so it carries a real presence rather than a hint of one.
  fresh: 0.62,
  moderate: 0.72,
  fatigued: 0.88,
  volume_low: 0.55,
  volume_medium: 0.7,
  volume_high: 0.86,
  // The one layer where lighting a region up is the whole point: it is
  // pointing at what to train, not reporting a value to read off.
  in_session: 1,
  // The two states that mean "nothing to say here" stay dark. An unknown
  // region must never draw the eye, and everything outside today's session
  // recedes so the session reads at a glance.
  unknown: 0,
  not_in_session: 0,
};

/** Added on top for the region the athlete has selected, whatever its state. */
export const TWIN_SELECTION_GLOW = 0.3;

/** Existing 2D renderer tones, sharing the same semantic layer vocabulary. */
export function twinDisplayToneFor2D(tone: TwinDisplayTone) {
  if (tone === "fresh") return "cool";
  if (tone === "moderate") return "warm";
  if (tone === "fatigued") return "hot";
  if (tone === "unknown") return "muted";
  if (tone === "in_session") return "cool";
  if (tone === "not_in_session") return "muted";
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
  // `todays_session` falls out here too, and must: its evidence is the
  // programme, which this function has never been given.
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
  layer: TwinLayer | "session_sets" | "session_volume";
  dataAvailable: boolean;
  regions: TwinSceneRegion[];
};

/**
 * What today's session asks of a region, as a display the figure can wear.
 *
 * Deliberately separate from `getTwinRegionDisplay`, which reads the snapshot
 * and only the snapshot. This layer's evidence is the programme, and no
 * amount of recovery data can answer it — so a figure asked for this layer
 * without it says "unknown" rather than painting every region as untrained.
 */
export function twinSessionDisplay(
  session: { byRegion: Readonly<Record<string, readonly unknown[]>> } | null,
  region: string,
): TwinRegionDisplay {
  if (!session) return { value: null, tone: "unknown" };
  const work = session.byRegion[region];
  if (!work) return { value: null, tone: "not_in_session" };
  return { value: work.length, tone: "in_session" };
}

/** No new physiological calculation: both values come from the canonical snapshot. */
export function mapTwinScene(
  snapshot: TwinSnapshot,
  layer: TwinLayer = "recovery",
  /** Required by the `todays_session` layer; ignored by the other two. */
  session: { byRegion: Readonly<Record<string, readonly unknown[]>> } | null = null,
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
        display:
          layer === "todays_session"
            ? twinSessionDisplay(session, id)
            : getTwinRegionDisplay(snapshot, id, layer),
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
  // Close enough to fill the frame with one muscle. This was 0.58, which is a
  // magnification of about 1.35x — the athlete could never get near enough to
  // look at a pectoral, only at a slightly larger whole body.
  minDistanceRatio: 0.22,
  maxDistanceRatio: 1.35,
  step: Math.PI / 8,
} as const;

/**
 * The figure the camera has to frame, measured on the shipped asset rather
 * than guessed. `public/models/twin-anatomy-v1.glb` stands 1.70 m tall from
 * the soles at y = 0, and its widest horizontal section — fingertip to
 * fingertip across the hands, and front to back at the buttocks — turns
 * inside a circle 0.72 m across, so that is the width the frame needs at any
 * yaw. `eyeHeight` is where the camera looks: a touch above the body's own
 * mid at 0.85 m, which puts the torso in the middle of the frame instead of
 * the hips.
 *
 * These were 1.95 m and 1.08 m, which is a body a head taller and half a
 * metre wider than the one on screen. On a phone the width guard dominated
 * and the figure came out at about two thirds of the frame it could have
 * had — the "little figurine" the athlete could not get near.
 */
export const TWIN_FRAME = {
  height: 1.7,
  turnDiameter: 0.72,
  eyeHeight: 0.88,
  /** Air around the body, so it never touches the edge of the canvas. */
  padding: 1.04,
} as const;

export const TWIN_FIELD_OF_VIEW = 35;

export function fittedTwinDistance(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 0.7;
  const tangent = Math.tan((TWIN_FIELD_OF_VIEW * Math.PI) / 360);
  // The camera looks at eyeHeight, so the frame has to reach the further of
  // the two ends from there — measuring from the body's mid instead would cut
  // the feet off whenever the eye sits above it.
  const halfHeight = Math.max(TWIN_FRAME.eyeHeight, TWIN_FRAME.height - TWIN_FRAME.eyeHeight);
  const framedHeight = 2 * halfHeight * TWIN_FRAME.padding;
  const framedWidth = TWIN_FRAME.turnDiameter * TWIN_FRAME.padding;
  return Math.max(framedHeight / (2 * tangent), framedWidth / (2 * tangent * safeAspect));
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
