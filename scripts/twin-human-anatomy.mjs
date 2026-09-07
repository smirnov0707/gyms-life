/**
 * Where the muscles of the front torso actually sit on the figure.
 *
 * Region assignment everywhere else in this build comes from the rig: a
 * vertex belongs to whichever deform bone dominates it. That works for limbs,
 * because an arm bone only ever skins an arm. It fails on the torso, because
 * the spine is a straight chain of segments and a muscle is not: the chest
 * came out as everything DEF-spine.002 and .003 dominated, which is a
 * full-width band of ribcage 26 cm tall on a 1.7 m figure, running from the
 * upper abdomen to the collarbone. Lit up, that band reads as a tube top
 * rather than as pectorals — the coloured-clothing look the figure exists to
 * avoid.
 *
 * Bones cannot answer this. So the front torso is cut by where the muscles
 * are instead, in coordinates measured off the figure rather than in metres,
 * so the same rule fits the male and the female mesh and would fit a third.
 *
 *   u  lateral position, -1 at the figure's left edge, +1 at its right
 *   v  height within the front torso, 0 at its lowest point, 1 at its highest
 *
 * Pure and total: no geometry, no file access, so the boundaries can be
 * tested as arithmetic.
 */

/** The regions this rule partitions. Everything else keeps its bone answer. */
export const FRONT_TORSO_REGIONS = ["chest", "abs", "core"];

/**
 * Where the pectorals begin at the midline, as a fraction of the front torso's
 * height.
 *
 * The inframammary line — the lower border of the pec — sits at roughly the
 * fifth rib, which on this figure is a little above two thirds of the way up
 * the front torso. Below it is abdomen, not chest.
 *
 * This is the border's value at the breastbone, which is inside the sternum
 * gap and so never actually assigned; the border every visible column of the
 * chest uses sits a little above it, by the rise below.
 */
export const CHEST_FLOOR_V = 0.66;

/**
 * How much lower the pec's border runs at the sternum than at the armpit.
 *
 * The border is not a straight line: it rises as it travels outward toward
 * the arm. A horizontal cut is exactly what made the old band look like a hem.
 */
export const CHEST_FLOOR_RISE = 0.1;

/**
 * Half-width of the sternum gap, as a fraction of the half-torso.
 *
 * The two pecs do not meet in the middle; a groove runs down the breastbone
 * between them. It is the single feature that most makes a lit region read as
 * muscle rather than as fabric, so the gap is cut deliberately rather than
 * left to chance.
 */
export const STERNUM_HALF_WIDTH_U = 0.1;

/** Where the abdominals stop and the obliques and lower belly take over. */
export const ABS_FLOOR_V = 0.32;

/** Half-width of the rectus abdominis, as a fraction of the half-torso. */
export const ABS_HALF_WIDTH_U = 0.5;

/**
 * The muscle at a point on the front torso, or null for surface the app holds
 * no reading for — the breastbone between the pecs, and the flanks beside the
 * abdominals below the ribs.
 *
 * @param {number} u lateral position across the torso, -1 to 1
 * @param {number} v height within the front torso, 0 to 1
 * @returns {"chest" | "abs" | "core" | null}
 */
export function frontTorsoMuscle(u, v) {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const lateral = Math.abs(u);

  // The pec's lower border, lowest at the sternum and rising as it runs out
  // toward the armpit, where the muscle folds up into the arm.
  const chestFloor = CHEST_FLOOR_V + CHEST_FLOOR_RISE * (1 - (lateral - 1) * (lateral - 1));
  if (v >= chestFloor) {
    return lateral < STERNUM_HALF_WIDTH_U ? null : "chest";
  }

  if (v >= ABS_FLOOR_V) {
    return lateral <= ABS_HALF_WIDTH_U ? "abs" : "core";
  }

  return "core";
}
