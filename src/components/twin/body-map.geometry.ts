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
    c(112, 16, 121, 26, 121, 38), // cranium
    c(121, 50, 119, 57, 115, 63), // temple into the cheekbone
    c(113, 69, 111, 74, 110, 79), // jaw angle into the neck
    c(117, 84, 125, 88, 133, 94), // upper trapezius
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
const JAWLINE: Shape = { from: [115, 62], curves: [c(114, 69, 109, 74, 100, 75)] };
const EYE_LINE: Shape = { from: [103, 48], curves: [c(107, 46, 113, 47, 117, 49)] };
const NOSE_EDGE: Shape = {
  from: [101, 47],
  curves: [c(102, 52, 103, 57, 104, 60), c(103, 62, 101, 62, 100, 62)],
};
const EAR: Shape = { from: [118, 44], curves: [c(123, 45, 123, 57, 118, 59)] };
const STERNOCLEIDOMASTOID: Shape = { from: [110, 64], curves: [c(108, 72, 105, 79, 101, 87)] };
const CLAVICLE: Shape = { from: [101, 98], curves: [c(111, 95, 122, 99, 131, 107)] };
const PECTORAL_HEADS: Shape = { from: [103, 121], curves: [c(113, 118, 124, 116, 133, 118)] };
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
      line(EYE_LINE),
      line(NOSE_EDGE),
      line(EAR),
      line(STERNOCLEIDOMASTOID),
      line(CLAVICLE),
      line(PECTORAL_HEADS),
      line(DELTOID_HEADS),
      line(BICEPS_GROOVE),
      line(FOREARM_SPLIT),
      line(ELBOW_CREASE),
      line(KNUCKLES),
      ...SERRATUS.map(line),
      line(INGUINAL_CREASE),
      line(PATELLA),
      line(TIBIA),
      line(MALLEOLUS),
      // The navel sits on the centre line, so it is not a mirrored pair.
      "M97 206C99 204 101 204 103 206",
    ].join(" "),
    back: [
      trace(SPINE),
      line(EAR),
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
// The muscle map
//
// Every belly the eye expects to see is drawn, whether or not we have a
// signal for it. A group's paths may overlap freely: each region renders as
// one `<path>`, so a shared fill unions instead of stacking opacity, and the
// stroke traces every internal seam as a muscle separation.
// ---------------------------------------------------------------------------

// --- shoulder ---------------------------------------------------------------

/** Starts at the acromion, not the neck: the trapezius owns the slope. */
const DELTOID_ANTERIOR: Shape = {
  from: [133, 100],
  curves: [
    c(138, 97, 143, 98, 146, 101),
    c(148, 113, 148, 128, 147, 145),
    c(143, 142, 138, 134, 135, 124),
    c(133, 115, 132, 105, 133, 100),
  ],
};

const DELTOID_LATERAL: Shape = {
  from: [146, 101],
  curves: [
    c(152, 105, 157, 113, 158, 125),
    c(159, 136, 157, 147, 153, 155),
    c(150, 153, 148, 150, 147, 145),
    c(148, 128, 148, 113, 146, 101),
  ],
};

const DELTOID_POSTERIOR: Shape = {
  from: [133, 102],
  curves: [
    c(139, 99, 144, 100, 147, 104),
    c(148, 116, 148, 131, 147, 147),
    c(142, 144, 137, 136, 134, 126),
    c(132, 116, 131, 106, 133, 102),
  ],
};

// --- arm --------------------------------------------------------------------

const BICEPS_LONG: Shape = {
  from: [147, 142],
  curves: [
    c(154, 146, 158, 157, 158, 172),
    c(158, 187, 155, 198, 150, 205),
    c(148, 203, 147, 196, 147, 186),
    c(147, 171, 147, 156, 147, 142),
  ],
};

const BICEPS_SHORT: Shape = {
  from: [147, 142],
  curves: [
    c(147, 156, 147, 171, 147, 186),
    c(147, 196, 148, 203, 150, 205),
    c(145, 204, 141, 196, 139, 183),
    c(138, 167, 138, 152, 140, 141),
    c(142, 140, 145, 141, 147, 142),
  ],
};

const TRICEPS_LONG: Shape = {
  from: [145, 141],
  curves: [
    c(145, 156, 145, 170, 145, 184),
    c(145, 194, 146, 201, 148, 206),
    c(144, 205, 140, 197, 139, 184),
    c(138, 166, 138, 150, 141, 140),
    c(142, 139, 144, 140, 145, 141),
  ],
};

const TRICEPS_LATERAL: Shape = {
  from: [145, 141],
  curves: [
    c(152, 145, 158, 157, 158, 173),
    c(158, 188, 155, 199, 150, 206),
    c(147, 203, 145, 195, 145, 184),
    c(145, 170, 145, 156, 145, 141),
  ],
};

/** Brachioradialis and the extensor mass, on the thumb side. */
const FOREARM_LATERAL: Shape = {
  from: [148, 206],
  curves: [
    c(155, 211, 160, 224, 161, 240),
    c(161, 254, 158, 268, 153, 281),
    c(150, 278, 149, 268, 149, 255),
    c(148, 238, 148, 221, 148, 206),
  ],
};

const FOREARM_MEDIAL: Shape = {
  from: [148, 206],
  curves: [
    c(148, 221, 148, 238, 149, 255),
    c(149, 268, 150, 278, 153, 281),
    c(149, 285, 145, 283, 143, 275),
    c(141, 258, 139, 232, 139, 209),
    c(142, 206, 145, 205, 148, 206),
  ],
};

const ARM_FRONT: BodySegment[] = [
  BICEPS_LONG,
  BICEPS_SHORT,
  FOREARM_LATERAL,
  FOREARM_MEDIAL,
].flatMap(pair);
const ARM_BACK: BodySegment[] = [
  TRICEPS_LONG,
  TRICEPS_LATERAL,
  FOREARM_LATERAL,
  FOREARM_MEDIAL,
].flatMap(pair);

// --- chest ------------------------------------------------------------------

/** Lower at the sternum than laterally, as a real pectoral hangs. */
const PECTORAL: Shape = {
  from: [102, 107],
  curves: [
    c(113, 104, 126, 106, 133, 113),
    c(138, 119, 138, 132, 132, 141),
    c(124, 149, 112, 151, 102, 150),
    c(102, 136, 102, 122, 102, 107),
  ],
};

// --- trunk, front -----------------------------------------------------------

/** The upper trapezius is visible from the front too, so it is drawn there. */
const TRAPEZIUS_FRONT: Shape = {
  from: [100, 84],
  curves: [
    c(112, 87, 124, 92, 133, 100),
    c(137, 104, 134, 110, 129, 108),
    c(118, 102, 109, 99, 100, 99),
    c(98, 97, 98, 86, 100, 84),
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

// --- trunk, back ------------------------------------------------------------

const TRAPEZIUS_UPPER: Shape = {
  from: [100, 86],
  curves: [
    c(108, 88, 118, 94, 126, 102),
    c(130, 107, 128, 113, 123, 112),
    c(113, 108, 106, 105, 100, 104),
    c(100, 98, 100, 92, 100, 86),
  ],
};

/** The lower fibres, converging from the scapulae down to the mid-spine. */
const TRAPEZIUS_LOWER: Shape = {
  from: [100, 105],
  curves: [
    c(111, 109, 122, 117, 129, 127),
    c(131, 131, 128, 136, 124, 134),
    c(115, 142, 107, 150, 100, 158),
    c(100, 140, 100, 122, 100, 105),
  ],
};

const INFRASPINATUS: Shape = {
  from: [110, 113],
  curves: [
    c(122, 114, 133, 121, 137, 131),
    c(133, 137, 121, 134, 113, 128),
    c(109, 124, 107, 114, 110, 113),
  ],
};

const TERES_MAJOR: Shape = {
  from: [116, 136],
  curves: [
    c(126, 138, 135, 143, 137, 150),
    c(132, 154, 122, 150, 116, 145),
    c(113, 142, 113, 135, 116, 136),
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
  from: [100, 168],
  curves: [
    c(105, 170, 109, 178, 111, 190),
    c(113, 205, 113, 224, 110, 235),
    c(106, 237, 102, 236, 100, 234),
    c(100, 212, 100, 190, 100, 168),
  ],
};

// --- hip --------------------------------------------------------------------

const GLUTEUS_MAXIMUS: Shape = {
  from: [100, 237],
  curves: [
    c(112, 232, 124, 236, 129, 248),
    c(134, 258, 133, 271, 126, 278),
    c(118, 284, 106, 282, 101, 272),
    c(100, 261, 100, 249, 100, 237),
  ],
};

/** The upper-outer wedge above the maximus, on the iliac crest. */
const GLUTEUS_MEDIUS: Shape = {
  from: [117, 228],
  curves: [
    c(126, 230, 133, 238, 133, 250),
    c(130, 255, 122, 250, 116, 243),
    c(112, 238, 113, 227, 117, 228),
  ],
};

// --- thigh ------------------------------------------------------------------

const VASTUS_LATERALIS: Shape = {
  from: [113, 258],
  curves: [
    c(124, 257, 132, 264, 135, 276),
    c(137, 291, 133, 313, 128, 332),
    c(125, 341, 122, 348, 118, 349),
    c(117, 340, 118, 320, 117, 300),
    c(116, 282, 114, 268, 113, 258),
  ],
};

const RECTUS_FEMORIS: Shape = {
  from: [106, 258],
  curves: [
    c(107, 272, 108, 290, 109, 308),
    c(110, 326, 112, 341, 114, 349),
    c(116, 350, 117, 350, 118, 349),
    c(117, 340, 118, 320, 117, 300),
    c(116, 282, 114, 268, 113, 258),
    c(111, 257, 108, 257, 106, 258),
  ],
};

/** The teardrop above the inner knee. */
const VASTUS_MEDIALIS: Shape = {
  from: [105, 302],
  curves: [
    c(110, 304, 113, 314, 114, 328),
    c(115, 340, 114, 348, 112, 350),
    c(108, 349, 105, 340, 104, 328),
    c(103, 316, 103, 306, 105, 302),
  ],
};

const ADDUCTORS: Shape = {
  from: [101, 258],
  curves: [
    c(104, 266, 106, 278, 107, 292),
    c(108, 304, 108, 314, 106, 320),
    c(103, 316, 101, 300, 100, 280),
    c(100, 270, 100, 262, 101, 258),
  ],
};

const HAMSTRING_LATERAL: Shape = {
  from: [116, 281],
  curves: [
    c(127, 279, 134, 286, 135, 296),
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
    c(105, 310, 103, 290, 104, 280),
    c(108, 278, 112, 279, 116, 281),
  ],
};

// --- lower leg --------------------------------------------------------------

const TIBIALIS_ANTERIOR: Shape = {
  from: [110, 356],
  curves: [
    c(116, 356, 119, 366, 119, 380),
    c(119, 396, 117, 412, 115, 424),
    c(113, 428, 111, 426, 110, 419),
    c(108, 400, 107, 372, 110, 356),
  ],
};

const PERONEAL: Shape = {
  from: [119, 358],
  curves: [
    c(126, 360, 130, 370, 131, 382),
    c(132, 396, 129, 410, 124, 421),
    c(121, 419, 120, 408, 120, 394),
    c(119, 380, 119, 368, 119, 358),
  ],
};

const GASTROCNEMIUS_LATERAL: Shape = {
  from: [121, 357],
  curves: [
    c(129, 360, 133, 370, 133, 384),
    c(133, 397, 130, 408, 126, 416),
    c(123, 412, 121, 401, 121, 386),
    c(121, 376, 121, 366, 121, 357),
  ],
};

/** The medial head sits lower than the lateral one, as it does in life. */
const GASTROCNEMIUS_MEDIAL: Shape = {
  from: [121, 357],
  curves: [
    c(121, 366, 121, 376, 121, 386),
    c(122, 402, 120, 414, 117, 421),
    c(113, 417, 110, 405, 109, 390),
    c(108, 376, 112, 361, 121, 357),
  ],
};

const SOLEUS_LATERAL: Shape = {
  from: [124, 396],
  curves: [
    c(128, 400, 129, 407, 127, 415),
    c(125, 421, 122, 422, 121, 418),
    c(120, 410, 121, 400, 124, 396),
  ],
};

const SOLEUS_MEDIAL: Shape = {
  from: [112, 398],
  curves: [
    c(115, 402, 116, 410, 115, 418),
    c(113, 424, 111, 425, 110, 421),
    c(109, 412, 110, 402, 112, 398),
  ],
};

const LEG_FRONT: BodySegment[] = [
  VASTUS_LATERALIS,
  RECTUS_FEMORIS,
  VASTUS_MEDIALIS,
  ADDUCTORS,
  TIBIALIS_ANTERIOR,
  PERONEAL,
].flatMap(pair);

const LEG_BACK: BodySegment[] = [
  HAMSTRING_LATERAL,
  HAMSTRING_MEDIAL,
  GASTROCNEMIUS_LATERAL,
  GASTROCNEMIUS_MEDIAL,
  SOLEUS_LATERAL,
  SOLEUS_MEDIAL,
].flatMap(pair);

// --- structure with no training group ---------------------------------------

const STERNOCLEIDOMASTOID_BELLY: Shape = {
  from: [111, 63],
  curves: [
    c(110, 71, 106, 80, 103, 89),
    c(101, 91, 99, 89, 100, 86),
    c(102, 77, 104, 68, 106, 61),
    c(108, 60, 110, 61, 111, 63),
  ],
};

/**
 * Facial structure, at the level an anatomy model carries it: a brow ridge
 * and a nose that catch the light, with the eye line and mouth as creases.
 * Enough that the head reads as a head, and no more — this is nobody's face.
 */
const BROW_RIDGE: Shape = {
  from: [100, 41],
  curves: [c(106, 39, 113, 40, 118, 44), c(116, 47, 108, 46, 100, 46)],
};

const PATELLA_BELLY: Shape = {
  from: [111, 349],
  curves: [
    c(117, 347, 123, 349, 126, 353),
    c(127, 359, 123, 364, 117, 364),
    c(112, 364, 109, 359, 109, 354),
    c(109, 351, 110, 349, 111, 349),
  ],
};

/**
 * Muscle and bone that belongs to no training group. Drawn in the neutral
 * tone so the whole body reads as anatomy, never as a claim about load.
 */
export const BODY_ANATOMY: Record<BodyView, string[]> = {
  front: [...pair(STERNOCLEIDOMASTOID_BELLY), ...pair(PATELLA_BELLY)].map((segment) => segment.d),
  back: pair(PATELLA_BELLY).map((segment) => segment.d),
};

/**
 * Which muscle groups map to drawable body regions, per view. Groups that
 * are not body regions at all (cardio, mobility, fullbody) are intentionally
 * absent — see NON_ANATOMICAL_GROUPS.
 */
export const BODY_REGION_SEGMENTS: Record<string, Partial<Record<BodyView, BodySegment[]>>> = {
  shoulders: {
    front: [...pair(DELTOID_ANTERIOR), ...pair(DELTOID_LATERAL)],
    back: [...pair(DELTOID_POSTERIOR), ...pair(DELTOID_LATERAL)],
  },
  arms: { front: ARM_FRONT, back: ARM_BACK },
  legs: { front: LEG_FRONT, back: LEG_BACK },
  chest: { front: pair(PECTORAL) },
  abs: { front: ABS_SEGMENTS },
  core: { front: pair(OBLIQUE) },
  back: {
    // The upper trapezius is genuinely visible from the front, so back work
    // shows there too rather than the front view pretending it does not exist.
    front: pair(TRAPEZIUS_FRONT),
    back: [
      ...pair(TRAPEZIUS_UPPER),
      ...pair(TRAPEZIUS_LOWER),
      ...pair(INFRASPINATUS),
      ...pair(TERES_MAJOR),
      ...pair(LATISSIMUS),
      ...pair(ERECTOR_SPINAE),
    ],
  },
  glutes: { back: [...pair(GLUTEUS_MAXIMUS), ...pair(GLUTEUS_MEDIUS)] },
};

/**
 * Where a leader line meets each region, per view. Used to label the region
 * the person has selected without covering the figure.
 */
export const REGION_ANCHOR: Record<string, Partial<Record<BodyView, { x: number; y: number }>>> = {
  shoulders: { front: { x: 152, y: 126 }, back: { x: 152, y: 128 } },
  arms: { front: { x: 152, y: 175 }, back: { x: 152, y: 176 } },
  chest: { front: { x: 122, y: 132 } },
  abs: { front: { x: 110, y: 190 } },
  core: { front: { x: 126, y: 185 } },
  back: { front: { x: 118, y: 96 }, back: { x: 124, y: 140 } },
  glutes: { back: { x: 118, y: 258 } },
  legs: { front: { x: 126, y: 300 }, back: { x: 126, y: 306 } },
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

/**
 * The side a region should be read on. A region can appear on both — the
 * upper trapezius is genuinely visible from the front — so "drawable here"
 * is not enough to stay put, or selecting the back would leave the figure on
 * the front with only that one strip lit.
 */
export function viewShowing(region: string, current: BodyView): BodyView {
  const other: BodyView = current === "front" ? "back" : "front";
  const here = segmentsFor(region, current).length;
  if (here === 0) return other;
  return segmentsFor(region, other).length > here ? other : current;
}
