/**
 * Anatomical body geometry for the Digital Twin.
 *
 * The figure is a real human silhouette drawn at roughly eight-head
 * proportion: a cranium that narrows through the temple to the jaw, a neck
 * with the sternocleidomastoid ridge, an elbow that steps out at the
 * epicondyle, a hand with separated fingers, a knee that bulges at the
 * condyle, and feet with toes. Each muscle group is described by the shape
 * it actually has on the body.
 *
 * Detail comes in two layers, and the split is the point:
 * - **Filled regions** carry data. One colour covers every path belonging
 *   to a muscle group — we never split a group into sub-muscles it has no
 *   separate evidence for.
 * - **Contours** are stroke-only anatomy: the jawline, clavicles, serratus
 *   digitations, deltoid heads, the biceps groove, the patella, the
 *   gluteal fold, the scapulae. They make the figure read as a body and
 *   claim nothing at all.
 *
 * Everything is authored for the right half of the body and mirrored, so
 * the figure cannot drift out of symmetry.
 */

export type BodyView = "front" | "back";

/** One drawable piece of a region: an SVG path `d` string. */
export type BodySegment = { d: string };

/**
 * The figure occupies x 36..164 and y 16..454; the box is padded just enough
 * for the framing ticks and the ground glow, so the figure stays the
 * dominant thing in its container rather than floating in empty space.
 */
export const BODY_VIEW_BOX = { minX: -8, minY: -10, width: 216, height: 486 } as const;

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

/** An open line and its mirror image, for stroke-only anatomy. */
function line(shape: Shape): string {
  return `${trace(shape)} ${trace(mirrorShape(shape))}`;
}

// ---------------------------------------------------------------------------
// Silhouette (never a data region: head, neck, hands, feet and the body mass
// beneath every muscle group)
// ---------------------------------------------------------------------------

/** Crown → jaw → neck → shoulder → ribs → waist → hip → leg → toes → crotch. */
const BODY_HALF: Shape = {
  from: [100, 16],
  curves: [
    c(109, 16, 115, 26, 115, 37), // cranium
    c(115, 47, 114, 53, 112, 59), // temple into the cheekbone
    c(111, 65, 109, 70, 108, 77), // jaw angle into the neck
    c(115, 82, 124, 87, 133, 94), // upper trapezius
    c(142, 99, 150, 106, 156, 116), // shoulder
    c(160, 126, 161, 136, 159, 147), // deltoid
    c(151, 142, 143, 132, 135, 120), // armpit
    c(137, 133, 137, 149, 135, 165), // ribcage under the lat
    c(132, 182, 127, 197, 125, 211), // waist
    c(130, 221, 134, 232, 134, 245), // iliac crest
    c(136, 261, 136, 276, 133, 292), // outer thigh
    c(131, 310, 130, 332, 128, 350), // above the knee
    c(130, 358, 131, 364, 130, 370), // lateral condyle
    c(134, 380, 136, 392, 134, 407), // calf belly
    c(131, 418, 127, 426, 125, 435), // shank into the lateral malleolus
    c(125, 443, 123, 450, 118, 452), // outer foot
    c(115, 453, 113, 452, 112, 449), // toes
    c(110, 453, 108, 453, 106, 450),
    c(104, 452, 103, 449, 103, 444),
    c(103, 433, 105, 421, 106, 407), // inner ankle
    c(107, 393, 108, 380, 108, 368), // inner calf
    c(108, 360, 108, 354, 107, 348), // inner knee
    c(106, 320, 104, 288, 101, 262), // inner thigh
    c(101, 258, 100, 256, 100, 254), // crotch
  ],
};

/** Hangs free of the torso below the armpit, as a real arm does. */
const ARM_OUTLINE: Shape = {
  from: [153, 126],
  curves: [
    c(162, 140, 164, 163, 160, 184), // outer upper arm
    c(158, 192, 157, 199, 156, 206), // lateral epicondyle
    c(161, 218, 163, 236, 161, 252), // brachioradialis
    c(159, 266, 155, 278, 151, 288), // taper to the wrist
    c(156, 291, 158, 298, 155, 304), // thumb
    c(153, 309, 153, 315, 152, 320), // index
    c(150, 323, 148, 323, 147, 319),
    c(146, 323, 144, 323, 143, 320), // middle and ring
    c(141, 322, 139, 320, 138, 315),
    c(136, 306, 135, 296, 137, 287), // back along the palm edge
    c(139, 272, 141, 252, 140, 234), // inner forearm
    c(139, 222, 139, 213, 138, 205), // medial epicondyle
    c(136, 187, 135, 158, 137, 139), // inner upper arm
    c(140, 128, 147, 122, 153, 126),
  ],
};

// Stroke-only anatomy. None of these carry a measurement; they exist so the
// figure reads as a body rather than as a diagram of coloured shapes.
const JAWLINE: Shape = { from: [112, 59], curves: [c(111, 66, 107, 71, 100, 72)] };
const EAR: Shape = { from: [112, 45], curves: [c(116, 46, 116, 55, 112, 57)] };
const HAIRLINE: Shape = { from: [100, 26], curves: [c(107, 25, 112, 28, 114, 34)] };
const STERNOCLEIDOMASTOID: Shape = { from: [110, 64], curves: [c(108, 72, 105, 79, 101, 87)] };
const CLAVICLE: Shape = { from: [101, 98], curves: [c(111, 95, 122, 99, 131, 107)] };
const DELTOID_HEADS: Shape = { from: [139, 107], curves: [c(141, 120, 143, 133, 144, 148)] };
const BICEPS_GROOVE: Shape = { from: [148, 150], curves: [c(150, 164, 150, 180, 149, 196)] };
const TRICEPS_HORSESHOE: Shape = { from: [143, 150], curves: [c(146, 167, 146, 186, 144, 200)] };
const FOREARM_SPLIT: Shape = { from: [150, 218], curves: [c(152, 234, 152, 252, 150, 268)] };
const ELBOW_CREASE: Shape = { from: [141, 206], curves: [c(146, 209, 152, 209, 156, 205)] };
const ELBOW_POINT: Shape = { from: [141, 204], curves: [c(146, 200, 151, 200, 155, 204)] };
const KNUCKLES: Shape = { from: [138, 300], curves: [c(143, 297, 149, 297, 153, 300)] };
const SERRATUS = [
  { from: [126, 147], curves: [c(130, 150, 132, 154, 133, 158)] },
  { from: [124, 155], curves: [c(128, 158, 130, 162, 131, 166)] },
  { from: [122, 163], curves: [c(126, 166, 128, 170, 129, 174)] },
] satisfies Shape[];
const INGUINAL_CREASE: Shape = { from: [129, 231], curves: [c(124, 240, 114, 248, 104, 252)] };
const RECTUS_FEMORIS: Shape = { from: [110, 262], curves: [c(116, 281, 118, 306, 116, 331)] };
const PATELLA: Shape = { from: [112, 352], curves: [c(116, 347, 123, 348, 127, 354)] };
const TIBIA: Shape = { from: [110, 362], curves: [c(111, 382, 112, 402, 112, 422)] };
const MALLEOLUS: Shape = { from: [120, 430], curves: [c(123, 433, 124, 437, 123, 441)] };

const SPINE: Shape = { from: [100, 88], curves: [c(100, 138, 100, 185, 100, 238)] };
const SCAPULA_MEDIAL: Shape = { from: [107, 111], curves: [c(109, 125, 113, 138, 120, 147)] };
const SCAPULA_SPINE: Shape = { from: [109, 109], curves: [c(117, 111, 125, 116, 131, 123)] };
const GLUTEAL_FOLD: Shape = { from: [101, 277], curves: [c(110, 283, 121, 282, 128, 276)] };
const POPLITEAL_CREASE: Shape = { from: [110, 351], curves: [c(116, 348, 122, 349, 127, 353)] };
const ACHILLES: Shape = { from: [113, 417], curves: [c(114, 426, 114, 433, 113, 440)] };

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
  /** Stroke-only landmarks, drawn over the fills. Never a measurement. */
  contours: {
    front: [
      line(JAWLINE),
      line(EAR),
      line(HAIRLINE),
      line(STERNOCLEIDOMASTOID),
      line(CLAVICLE),
      line(DELTOID_HEADS),
      line(BICEPS_GROOVE),
      line(FOREARM_SPLIT),
      line(ELBOW_CREASE),
      line(KNUCKLES),
      ...SERRATUS.map(line),
      line(INGUINAL_CREASE),
      line(RECTUS_FEMORIS),
      line(PATELLA),
      line(TIBIA),
      line(MALLEOLUS),
      // The navel sits on the centre line, so it is not a mirrored pair.
      "M97 206C99 204 101 204 103 206",
    ].join(" "),
    back: [
      trace(SPINE),
      line(EAR),
      line(HAIRLINE),
      line(SCAPULA_MEDIAL),
      line(SCAPULA_SPINE),
      line(DELTOID_HEADS),
      line(TRICEPS_HORSESHOE),
      line(FOREARM_SPLIT),
      line(ELBOW_POINT),
      line(KNUCKLES),
      line(GLUTEAL_FOLD),
      line(POPLITEAL_CREASE),
      line(ACHILLES),
    ].join(" "),
  },
  /** Shoulder, waist and knee heights — framing ticks only, never data. */
  levels: [122, 211, 352] as const,
  groundY: 454,
} as const;

// ---------------------------------------------------------------------------
// Shared between views: the limbs look the same from front and back, only
// the muscle underneath is named differently.
// ---------------------------------------------------------------------------

/** Starts at the acromion, not the neck: the trapezius owns the slope. */
const DELTOID: Shape = {
  from: [133, 100],
  curves: [
    c(142, 96, 152, 105, 156, 120),
    c(159, 132, 158, 144, 154, 154),
    c(146, 151, 139, 142, 134, 130),
    c(131, 120, 130, 108, 133, 100),
  ],
};

/** Biceps from the front, triceps from the back — one arm, one signal. */
const UPPER_ARM: Shape = {
  from: [138, 139],
  curves: [
    c(151, 141, 160, 155, 160, 172),
    c(160, 188, 156, 199, 151, 206),
    c(145, 204, 140, 195, 138, 182),
    c(137, 166, 137, 150, 138, 139),
  ],
};

const FOREARM: Shape = {
  from: [139, 209],
  curves: [
    c(151, 212, 159, 226, 160, 243),
    c(161, 259, 156, 274, 151, 286),
    c(146, 284, 143, 276, 142, 265),
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
    c(128, 152, 131, 161, 131, 172),
    c(131, 187, 128, 201, 123, 212),
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
  absSegment(152, 174, 120, 120),
  absSegment(177, 197, 119, 119),
  absSegment(200, 218, 117, 116),
  absSegment(221, 248, 113, 104),
].flatMap(pair);

/** Vastus lateralis and rectus femoris: the outer two-thirds of the thigh. */
const QUAD_LATERAL: Shape = {
  from: [102, 257],
  curves: [
    c(119, 254, 131, 260, 135, 274),
    c(139, 291, 134, 315, 128, 334),
    c(125, 343, 122, 349, 118, 349),
    c(116, 341, 116, 322, 114, 301),
    c(111, 283, 106, 267, 102, 257),
  ],
};

/** Vastus medialis: shares the seam above exactly, so the two never overlap. */
const QUAD_MEDIAL: Shape = {
  from: [102, 257],
  curves: [
    c(106, 267, 111, 283, 114, 301),
    c(116, 322, 116, 341, 118, 349),
    c(113, 350, 109, 341, 107, 327),
    c(103, 304, 101, 277, 102, 257),
  ],
};

/** Tibialis anterior and the peroneal group, down to the ankle. */
const SHIN: Shape = {
  from: [108, 356],
  curves: [
    c(118, 353, 127, 358, 131, 368),
    c(134, 381, 132, 400, 127, 417),
    c(126, 424, 124, 430, 122, 432),
    c(118, 433, 114, 428, 113, 419),
    c(111, 399, 107, 372, 108, 356),
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
  from: [100, 86],
  curves: [
    c(107, 87, 116, 92, 124, 99),
    c(131, 106, 135, 117, 133, 130),
    c(126, 142, 113, 151, 100, 157),
    c(100, 133, 100, 110, 100, 86),
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
    c(112, 232, 124, 236, 129, 248),
    c(134, 258, 133, 271, 126, 278),
    c(118, 284, 106, 282, 101, 272),
    c(100, 262, 100, 249, 100, 237),
  ],
};

/** Biceps femoris, from the gluteal fold to the back of the knee. */
const HAMSTRING_LATERAL: Shape = {
  from: [116, 281],
  curves: [
    c(127, 277, 134, 284, 135, 295),
    c(136, 312, 132, 329, 126, 341),
    c(123, 347, 120, 350, 117, 350),
    c(116, 335, 116, 306, 116, 281),
  ],
};

const HAMSTRING_MEDIAL: Shape = {
  from: [116, 281],
  curves: [
    c(116, 306, 116, 335, 117, 350),
    c(113, 351, 110, 344, 108, 331),
    c(105, 310, 103, 289, 104, 278),
    c(108, 276, 112, 277, 116, 279),
  ],
};

const CALF_LATERAL: Shape = {
  from: [121, 357],
  curves: [
    c(129, 360, 133, 370, 133, 384),
    c(133, 398, 130, 411, 126, 421),
    c(123, 417, 121, 403, 121, 386),
    c(121, 376, 121, 366, 121, 357),
  ],
};

/** The medial head sits lower than the lateral one, as it does in life. */
const CALF_MEDIAL: Shape = {
  from: [121, 357],
  curves: [
    c(121, 366, 121, 376, 121, 386),
    c(122, 404, 120, 418, 117, 426),
    c(113, 422, 110, 409, 109, 393),
    c(108, 378, 112, 361, 121, 357),
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
