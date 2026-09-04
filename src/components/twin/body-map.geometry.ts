/**
 * Anatomical body geometry for the Digital Twin.
 *
 * The figure is a real human silhouette drawn at roughly eight-head
 * proportion, with each muscle group described by the shape it actually has
 * on the body (deltoid caps, pectorals, the rectus abdominis segments,
 * obliques, quadriceps heads, trapezius, latissimus, glutes, hamstrings,
 * gastrocnemius heads).
 *
 * Anatomical *shape* and data *precision* are separate things. The
 * underlying signal is still a coarse `muscle_group` label, so one colour
 * covers every path belonging to a group — we never split a group into
 * sub-muscles it has no separate evidence for. The internal seams are
 * anatomy, not extra resolution.
 *
 * Everything is authored for the right half of the body and mirrored, so
 * the figure cannot drift out of symmetry.
 */

export type BodyView = "front" | "back";

/** One drawable piece of a region: an SVG path `d` string. */
export type BodySegment = { d: string };

/**
 * The figure occupies x 37..163 and y 17..448; the box is padded just enough
 * for the framing ticks and the ground glow, so the figure stays the
 * dominant thing in its container rather than floating in empty space.
 */
export const BODY_VIEW_BOX = { minX: -8, minY: -10, width: 216, height: 478 } as const;

const CENTRE_X = 100;

type Point = readonly [number, number];
/** A cubic segment: two control points and an end point. */
type Curve = readonly [Point, Point, Point];
type Shape = { readonly from: Point; readonly curves: readonly Curve[] };

function c(x1: number, y1: number, x2: number, y2: number, x: number, y: number): Curve {
  return [
    [x1, y1],
    [x2, y2],
    [x, y],
  ];
}

function trace({ from, curves }: Shape): string {
  const start = `M${from[0]} ${from[1]}`;
  const body = curves
    .map(([c1, c2, to]) => `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`)
    .join("");
  return `${start}${body}`;
}

function toPath(shape: Shape): string {
  return `${trace(shape)}Z`;
}

function mirrorPoint([x, y]: Point): Point {
  return [2 * CENTRE_X - x, y];
}

/**
 * Reflects a shape across the body's centre line. The traversal order is
 * reversed as well as mirrored: reflection alone flips the winding
 * direction, which would punch holes instead of adding mass when several
 * sub-paths share one `<path>` element.
 */
function mirrorShape({ from, curves }: Shape): Shape {
  let cursor = from;
  const walked = curves.map(([c1, c2, to]) => {
    const segment = { start: cursor, c1, c2 };
    cursor = to;
    return segment;
  });
  const reversed = walked
    .reverse()
    .map(({ start, c1, c2 }): Curve => [mirrorPoint(c2), mirrorPoint(c1), mirrorPoint(start)]);
  return { from: mirrorPoint(cursor), curves: reversed };
}

/**
 * Closes a half-outline into a symmetric whole. The first and last points
 * must sit on the centre line, so the mirrored half joins seamlessly.
 */
function symmetric(shape: Shape): Shape {
  return { from: shape.from, curves: [...shape.curves, ...mirrorShape(shape).curves] };
}

/** The right-hand shape and its mirror image, as a drawable pair. */
function pair(shape: Shape): BodySegment[] {
  return [{ d: toPath(shape) }, { d: toPath(mirrorShape(shape)) }];
}

// ---------------------------------------------------------------------------
// Silhouette (never a data region: head, neck, hands, feet and the body mass
// beneath every muscle group)
// ---------------------------------------------------------------------------

/** Crown → jaw → neck → shoulder → ribs → waist → hip → leg → foot → crotch. */
const BODY_HALF: Shape = {
  from: [100, 17],
  curves: [
    c(110, 17, 116, 28, 116, 42),
    c(116, 53, 111, 62, 106, 67),
    c(108, 74, 109, 81, 110, 88),
    c(123, 92, 138, 97, 148, 107),
    c(157, 115, 162, 130, 160, 145),
    c(150, 139, 141, 129, 133, 119),
    c(136, 134, 136, 150, 134, 164),
    c(131, 181, 126, 196, 124, 210),
    c(130, 220, 133, 231, 133, 244),
    c(135, 260, 135, 274, 132, 290),
    c(131, 308, 130, 330, 128, 348),
    c(133, 361, 136, 377, 133, 397),
    c(130, 411, 126, 421, 123, 431),
    c(124, 442, 118, 448, 111, 448),
    c(105, 448, 102, 442, 102, 432),
    c(103, 415, 106, 399, 107, 381),
    c(108, 365, 108, 357, 107, 345),
    c(106, 318, 104, 288, 101, 262),
    c(101, 258, 100, 256, 100, 254),
  ],
};

/** Hangs free of the torso below the armpit, as a real arm does. */
const ARM_OUTLINE: Shape = {
  from: [154, 126],
  curves: [
    c(162, 140, 163, 165, 159, 187),
    c(157, 194, 156, 200, 155, 206),
    c(160, 222, 161, 246, 156, 264),
    c(153, 274, 151, 280, 149, 288),
    c(155, 294, 156, 306, 150, 313),
    c(144, 320, 137, 317, 134, 309),
    c(131, 301, 133, 292, 137, 286),
    c(139, 272, 141, 252, 140, 234),
    c(139, 222, 139, 212, 138, 204),
    c(136, 186, 135, 158, 137, 139),
    c(140, 128, 148, 122, 154, 126),
  ],
};

/** Collarbone, drawn as a line rather than filled: it carries no data. */
const CLAVICLE: Shape = {
  from: [101, 101],
  curves: [c(112, 98, 124, 102, 133, 110)],
};

const SPINE: Shape = {
  from: [100, 92],
  curves: [c(100, 140, 100, 180, 100, 240)],
};

export const BODY_FRAME = {
  /**
   * Body mass and outline, identical from both views. Three sub-paths in one
   * `d` so the whole figure fills and strokes as a single form.
   */
  silhouette: [
    toPath(symmetric(BODY_HALF)),
    toPath(ARM_OUTLINE),
    toPath(mirrorShape(ARM_OUTLINE)),
  ].join(" "),
  /** Stroke-only landmarks that read as anatomy but carry no measurement. */
  contours: {
    front: [trace(CLAVICLE), trace(mirrorShape(CLAVICLE))].join(" "),
    back: trace(SPINE),
  },
  /** Shoulder, waist and knee heights — framing ticks only, never data. */
  levels: [122, 208, 348] as const,
  groundY: 448,
} as const;

// ---------------------------------------------------------------------------
// Shared between views: the limbs look the same from front and back, only
// the muscle underneath is named differently.
// ---------------------------------------------------------------------------

const DELTOID: Shape = {
  from: [126, 102],
  curves: [
    c(138, 96, 151, 103, 157, 118),
    c(161, 130, 160, 143, 156, 153),
    c(147, 150, 139, 141, 132, 129),
    c(128, 120, 125, 110, 126, 102),
  ],
};

/** Biceps from the front, triceps from the back — one arm, one signal. */
const UPPER_ARM: Shape = {
  from: [138, 139],
  curves: [
    c(151, 141, 159, 155, 159, 172),
    c(159, 188, 155, 199, 150, 206),
    c(144, 204, 140, 195, 138, 182),
    c(137, 166, 137, 150, 138, 139),
  ],
};

const FOREARM: Shape = {
  from: [139, 209],
  curves: [
    c(150, 211, 157, 224, 158, 241),
    c(159, 257, 154, 273, 150, 285),
    c(145, 283, 143, 275, 142, 264),
    c(141, 246, 139, 227, 139, 209),
  ],
};

const ARM_SEGMENTS: BodySegment[] = [...pair(UPPER_ARM), ...pair(FOREARM)];
const SHOULDER_SEGMENTS: BodySegment[] = pair(DELTOID);

// ---------------------------------------------------------------------------
// Front
// ---------------------------------------------------------------------------

/** Starts off the centre line so the sternum stays a visible gap. */
const PECTORAL: Shape = {
  from: [102, 109],
  curves: [
    c(113, 105, 126, 107, 133, 114),
    c(139, 120, 139, 132, 133, 141),
    c(125, 149, 113, 151, 102, 150),
    c(102, 136, 102, 122, 102, 109),
  ],
};

/** External oblique sweeping from the lower ribs into the iliac crest. */
const OBLIQUE: Shape = {
  from: [122, 150],
  curves: [
    c(129, 152, 132, 161, 132, 172),
    c(132, 187, 128, 201, 123, 212),
    c(121, 217, 120, 214, 120, 206),
    c(119, 188, 120, 168, 122, 150),
  ],
};

/**
 * One segment of the rectus abdominis, bounded by the linea alba at the
 * centre line. The stack of these is anatomy, not per-segment data.
 */
function absSegment(yTop: number, yBottom: number, xTop: number, xBottom: number): Shape {
  return {
    from: [102, yTop],
    curves: [
      c(111, yTop - 2, xTop, yTop + 1, xTop, yTop + 6),
      c(xTop, yBottom - 6, xBottom + 1, yBottom - 2, xBottom, yBottom),
      c((xBottom + 102) / 2, yBottom + 1.5, 105, yBottom + 1, 102, yBottom),
      c(102, yBottom - 8, 102, yTop + 8, 102, yTop),
    ],
  };
}

const ABS_SEGMENTS: BodySegment[] = [
  absSegment(152, 174, 121, 121),
  absSegment(177, 197, 120, 120),
  absSegment(200, 218, 118, 117),
  absSegment(221, 248, 114, 105),
].flatMap(pair);

/** Vastus lateralis and rectus femoris: the outer two-thirds of the thigh. */
const QUAD_LATERAL: Shape = {
  from: [102, 257],
  curves: [
    c(119, 254, 131, 260, 135, 274),
    c(139, 291, 134, 314, 127, 332),
    c(124, 340, 121, 346, 117, 346),
    c(115, 338, 115, 320, 113, 300),
    c(111, 282, 106, 267, 102, 257),
  ],
};

/** Vastus medialis: shares the seam above exactly, so the two never overlap. */
const QUAD_MEDIAL: Shape = {
  from: [102, 257],
  curves: [
    c(106, 267, 111, 282, 113, 300),
    c(115, 320, 115, 338, 117, 346),
    c(112, 347, 108, 338, 106, 324),
    c(103, 302, 101, 277, 102, 257),
  ],
};

const SHIN: Shape = {
  from: [107, 352],
  curves: [
    c(117, 349, 126, 354, 130, 364),
    c(134, 377, 131, 397, 126, 414),
    c(125, 420, 123, 425, 121, 427),
    c(117, 428, 113, 424, 112, 415),
    c(110, 396, 106, 368, 107, 352),
  ],
};

const LEG_FRONT_SEGMENTS: BodySegment[] = [
  ...pair(QUAD_LATERAL),
  ...pair(QUAD_MEDIAL),
  ...pair(SHIN),
];

// ---------------------------------------------------------------------------
// Back
// ---------------------------------------------------------------------------

const TRAPEZIUS: Shape = {
  from: [100, 90],
  curves: [
    c(106, 90, 114, 95, 122, 103),
    c(130, 111, 135, 121, 133, 133),
    c(126, 144, 113, 152, 100, 157),
    c(100, 135, 100, 112, 100, 90),
  ],
};

/** The taper from armpit to waist that gives the back its V. */
const LATISSIMUS: Shape = {
  from: [100, 161],
  curves: [
    c(114, 155, 128, 146, 135, 134),
    c(139, 147, 139, 164, 134, 179),
    c(128, 195, 117, 205, 105, 211),
    c(102, 212, 100, 209, 100, 205),
    c(100, 190, 100, 175, 100, 161),
  ],
};

const ERECTOR_SPINAE: Shape = {
  from: [100, 204],
  curves: [
    c(106, 205, 111, 211, 113, 219),
    c(115, 226, 113, 232, 110, 235),
    c(106, 237, 102, 236, 100, 234),
    c(100, 224, 100, 214, 100, 204),
  ],
};

const BACK_SEGMENTS: BodySegment[] = [
  ...pair(TRAPEZIUS),
  ...pair(LATISSIMUS),
  ...pair(ERECTOR_SPINAE),
];

const GLUTE: Shape = {
  from: [100, 237],
  curves: [
    c(112, 231, 125, 235, 131, 247),
    c(137, 258, 136, 271, 128, 279),
    c(119, 286, 106, 282, 101, 273),
    c(100, 261, 100, 249, 100, 237),
  ],
};

/** Biceps femoris, from the gluteal fold to the back of the knee. */
const HAMSTRING_LATERAL: Shape = {
  from: [116, 278],
  curves: [
    c(127, 276, 134, 283, 135, 294),
    c(136, 310, 132, 326, 126, 338),
    c(123, 344, 120, 347, 117, 347),
    c(116, 332, 116, 304, 116, 278),
  ],
};

const HAMSTRING_MEDIAL: Shape = {
  from: [116, 278],
  curves: [
    c(116, 304, 116, 332, 117, 347),
    c(113, 348, 110, 341, 108, 328),
    c(105, 308, 103, 288, 104, 277),
    c(108, 275, 112, 276, 116, 278),
  ],
};

const CALF_LATERAL: Shape = {
  from: [120, 352],
  curves: [
    c(128, 355, 133, 365, 133, 379),
    c(133, 393, 130, 406, 126, 416),
    c(123, 412, 121, 398, 120, 381),
    c(120, 371, 120, 361, 120, 352),
  ],
};

/** The medial head sits lower than the lateral one, as it does in life. */
const CALF_MEDIAL: Shape = {
  from: [120, 352],
  curves: [
    c(120, 361, 120, 371, 120, 381),
    c(121, 399, 119, 413, 116, 421),
    c(112, 417, 109, 404, 108, 388),
    c(107, 373, 111, 356, 120, 352),
  ],
};

const LEG_BACK_SEGMENTS: BodySegment[] = [
  ...pair(HAMSTRING_LATERAL),
  ...pair(HAMSTRING_MEDIAL),
  ...pair(CALF_LATERAL),
  ...pair(CALF_MEDIAL),
];

/**
 * Which muscle groups map to drawable body regions, per view. Groups that
 * are not body regions at all (cardio, mobility, fullbody) are intentionally
 * absent — see NON_ANATOMICAL_GROUPS.
 */
export const BODY_REGION_SEGMENTS: Record<string, Partial<Record<BodyView, BodySegment[]>>> = {
  shoulders: { front: SHOULDER_SEGMENTS, back: SHOULDER_SEGMENTS },
  arms: { front: ARM_SEGMENTS, back: ARM_SEGMENTS },
  legs: { front: LEG_FRONT_SEGMENTS, back: LEG_BACK_SEGMENTS },
  chest: { front: pair(PECTORAL) },
  abs: { front: ABS_SEGMENTS },
  core: { front: pair(OBLIQUE) },
  back: { back: BACK_SEGMENTS },
  glutes: { back: pair(GLUTE) },
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
