/**
 * Maps the figure's deform bones onto the Twin's canonical body regions.
 *
 * Region assignment used to be a set of absolute-metre thresholds tuned to the
 * old generated surface (1.82 m tall, arms at its sides). Those numbers do not
 * transfer: this figure is 1.70 m and stands in an A-pose, so an arm boundary
 * measured sideways from the spine cuts through the wrong tissue.
 *
 * Bones do transfer. Every vertex is skinned, so its dominant deform bone says
 * which part of the body it belongs to regardless of pose or stature. The one
 * thing bones cannot answer is front from back — the spine runs up the middle,
 * so a chest vertex and a back vertex share a bone. That single distinction is
 * made from the local z sign, which is why FRONT_BACK exists below.
 *
 * Shared by scripts/prepare-twin-human.mjs and its test.
 */

/** Canonical regions, matching TWIN_BODY_REGIONS in twin-scene.model.ts. */
export const REGIONS = ["chest", "back", "shoulders", "arms", "legs", "glutes", "core", "abs"];

/** Anything the app holds no data for: head, face, neck, hands' own surfaces. */
export const NEUTRAL = "neutral";

/**
 * Region names travel from the build into the browser on material names,
 * because glTF primitives have no name of their own. The loader splits on this
 * prefix to recover which part of the body a mesh is.
 */
export const REGION_MATERIAL_PREFIX = "twin-region:";

/** Bone families that resolve to one region whichever way the vertex faces. */
const BY_FAMILY = new Map([
  ["DEF-shoulder", "shoulders"],
  ["DEF-upper_arm", "arms"],
  ["DEF-forearm", "arms"],
  ["DEF-hand", "arms"],
  ["DEF-palm", "arms"],
  ["DEF-thumb", "arms"],
  ["DEF-f_index", "arms"],
  ["DEF-f_middle", "arms"],
  ["DEF-f_ring", "arms"],
  ["DEF-f_pinky", "arms"],
  ["DEF-thigh", "legs"],
  ["DEF-shin", "legs"],
  ["DEF-foot", "legs"],
  ["DEF-toe", "legs"],
]);

/** Head and face bones. The app measures nothing here, so it stays neutral. */
const FACE = /^DEF-(ear|nose|tongue|jaw|forehead|lip|lid|chin|temple|cheek|brow|eye|teeth|skull)/;

/**
 * Torso bones, front and back. The spine chain is ordered from the pelvis up:
 * spine and spine.001 sit at the waist, .002 and .003 at the ribcage, .004 and
 * above are neck and head.
 */
const FRONT_BACK = new Map([
  ["DEF-spine", { front: "core", back: "back" }],
  ["DEF-spine.001", { front: "abs", back: "back" }],
  ["DEF-spine.002", { front: "chest", back: "back" }],
  ["DEF-spine.003", { front: "chest", back: "back" }],
  ["DEF-pelvis", { front: "core", back: "glutes" }],
  // The gluteal surface skins to the upper thigh bone in this rig, not to the
  // pelvis. Leaving it on DEF-pelvis alone gave glutes 72 triangles out of
  // 17,084 — a target too small to hit with a finger. Only the first thigh
  // segment is split this way; everything below it stays legs.
  ["DEF-thigh", { front: "legs", back: "glutes" }],
  ["DEF-breast", { front: "chest", back: "chest" }],
]);

/** Neck and head segments of the spine chain. */
const HEAD_SPINE = new Set(["DEF-spine.004", "DEF-spine.005", "DEF-spine.006"]);

/**
 * Strips the Sketchfab node suffix and the side marker, keeping chain indices.
 *
 * Rigify writes the side in the middle of a chained name — DEF-forearm.R.001,
 * not DEF-forearm.001.R — so a trailing-only strip leaves ".R.001" attached
 * and every chained limb bone falls through to neutral.
 */
export function normaliseBone(name) {
  return String(name)
    .replace(/_\d+$/, "")
    .replace(/\.(L|R)(?=\.|$)/, "");
}

/**
 * @param name  bone name as it appears in the glTF
 * @param front true when the vertex lies on the figure's front (local +z)
 */
export function regionForBone(name, front) {
  const bone = normaliseBone(name);
  if (FACE.test(bone) || HEAD_SPINE.has(bone)) return NEUTRAL;

  const sided = FRONT_BACK.get(bone);
  if (sided) return front ? sided.front : sided.back;

  // Chain segments (DEF-forearm.001) belong to their family.
  const family = bone.replace(/\.\d+$/, "");
  const direct = BY_FAMILY.get(bone) ?? BY_FAMILY.get(family);
  if (direct) return direct;

  const sidedFamily = FRONT_BACK.get(family);
  if (sidedFamily) return front ? sidedFamily.front : sidedFamily.back;

  // An unrecognised bone is left neutral rather than guessed into a region the
  // athlete would then read data from.
  return NEUTRAL;
}
