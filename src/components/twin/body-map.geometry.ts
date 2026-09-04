/**
 * Stylized body geometry for the Digital Twin.
 *
 * Deliberately a segmented mannequin, not an anatomical illustration: the
 * underlying data is a coarse 11-value `muscle_group` label, so drawing
 * realistic musculature would imply a precision the data does not have.
 * Simple segments read as an intentional abstraction instead.
 */
export type BodySegment = { x: number; y: number; w: number; h: number; rx: number };

export type BodyView = "front" | "back";

export const BODY_VIEW_BOX = { width: 100, height: 220 } as const;

/** Head and neck are decorative orientation cues, never a data region. */
export const BODY_FRAME = {
  head: { cx: 50, cy: 15, r: 10.5 },
  neck: { x: 46, y: 23, w: 8, h: 8, rx: 3 },
} as const;

// Shoulder pads deliberately overlap both the torso edge and the top of the
// upper arm, so the figure reads as connected rather than exploded.
const SHOULDERS: BodySegment[] = [
  { x: 18, y: 30, w: 20, h: 16, rx: 8 },
  { x: 62, y: 30, w: 20, h: 16, rx: 8 },
];

const ARMS: BodySegment[] = [
  { x: 19, y: 45, w: 12, h: 41, rx: 6 },
  { x: 69, y: 45, w: 12, h: 41, rx: 6 },
  { x: 19, y: 87, w: 11, h: 40, rx: 5 },
  { x: 70, y: 87, w: 11, h: 40, rx: 5 },
];

const LEGS: BodySegment[] = [
  { x: 35, y: 100, w: 14, h: 56, rx: 6 },
  { x: 51, y: 100, w: 14, h: 56, rx: 6 },
  { x: 37, y: 157, w: 11, h: 50, rx: 5 },
  { x: 52, y: 157, w: 11, h: 50, rx: 5 },
];

/**
 * Which muscle groups map to drawable body segments, per view. Groups that
 * are not body regions at all (cardio, mobility, fullbody) are intentionally
 * absent — see NON_ANATOMICAL_GROUPS.
 */
export const BODY_REGION_SEGMENTS: Record<string, Partial<Record<BodyView, BodySegment[]>>> = {
  shoulders: { front: SHOULDERS, back: SHOULDERS },
  arms: { front: ARMS, back: ARMS },
  legs: { front: LEGS, back: LEGS },
  chest: { front: [{ x: 32, y: 34, w: 36, h: 30, rx: 8 }] },
  abs: { front: [{ x: 40, y: 65, w: 20, h: 31, rx: 5 }] },
  core: {
    front: [
      { x: 32, y: 65, w: 7, h: 31, rx: 3 },
      { x: 61, y: 65, w: 7, h: 31, rx: 3 },
    ],
  },
  back: { back: [{ x: 32, y: 34, w: 36, h: 50, rx: 8 }] },
  glutes: { back: [{ x: 34, y: 85, w: 32, h: 14, rx: 7 }] },
};

/**
 * Real training groups that have no location on a body: showing them on the
 * silhouette would be inventing anatomy. They are surfaced separately.
 */
export const NON_ANATOMICAL_GROUPS = ["cardio", "mobility", "fullbody"] as const;

export function segmentsFor(region: string, view: BodyView): BodySegment[] {
  return BODY_REGION_SEGMENTS[region]?.[view] ?? [];
}

export function isAnatomicalRegion(region: string): boolean {
  return BODY_REGION_SEGMENTS[region] !== undefined;
}
