/**
 * Which anatomical muscle belongs to which of the Twin's eight regions.
 *
 * The figure used to be a smooth base mesh whose regions were cut out of one
 * continuous surface, so a "muscle" was a patch of skin with a boundary drawn
 * on it — no pectoral shape, no deltoid, nothing the eye reads as anatomy.
 * This maps the real thing instead: BodyParts3D ships every superficial muscle
 * as its own mesh, named in Terminologia Anatomica, so a region is the union
 * of the muscles that actually make it up.
 *
 * Names are matched rather than listed one by one, because the atlas splits
 * several muscles into parts (the clavicular, sternocostal and abdominal parts
 * of pectoralis major are three meshes) and the parts belong wherever their
 * muscle does.
 *
 * Pure: patterns only, no file access, so the mapping can be tested.
 */

/** Anything matching these is not muscle, whatever else its name contains. */
const NOT_MUSCLE = /artery|vein|nerve|branch|fascia|tendon|bursa|node|ligament|sheath|septum/i;

/**
 * One entry per region, in the order they are tried. A muscle matches the
 * first region whose pattern accepts it.
 */
const REGION_PATTERNS = [
  ["chest", /^(right |left )?(.*part of )?(right |left )?pectoralis (major|minor)$/i],
  ["shoulders", /^(right |left )?(.*part of )?(right |left )?deltoid$/i],
  [
    "back",
    /^(right |left )?(.*part of )?(right |left )?(latissimus dorsi|trapezius|infraspinatus|supraspinatus|teres (major|minor)|rhomboid (major|minor)|erector spinae|levator scapulae)$/i,
  ],
  [
    "arms",
    /^(right |left )?(.*head of )?(right |left )?(biceps brachii|triceps brachii|brachialis|brachioradialis|coracobrachialis|anconeus|pronator teres)$/i,
  ],
  // The atlas has no separate rectus abdominis: the front of the abdomen is
  // one mesh, carrying the names "muscle of anterior abdominal wall" and
  // "external oblique" alike. It goes to abs, which is the region an athlete
  // reads as the front of their abdomen, and it has to be claimed before core
  // or the same mesh would be filed under the flank instead.
  [
    "abs",
    /^(right |left )?(muscle of anterior abdominal wall|external oblique|internal oblique|rectus abdominis)$/i,
  ],
  ["core", /^(right |left )?(transversus abdominis|serratus anterior|quadratus lumborum)$/i],
  ["glutes", /^(right |left )?gluteus (maximus|medius|minimus)$/i],
  [
    "legs",
    /^(right |left )?(.*head of )?(right |left )?(rectus femoris|vastus (lateralis|medialis|intermedius)|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|soleus|sartorius|gracilis|adductor (magnus|longus|brevis)|tensor fasciae latae|tibialis anterior|peroneus longus|iliopsoas|psoas major)$/i,
  ],
];

/** The whole-body surface, which becomes the figure's silhouette. */
export const SKIN_NAME = "skin";

/** The regions this atlas can fill, in the order they are drawn. */
export const MUSCLE_REGIONS = REGION_PATTERNS.map(([region]) => region);

/**
 * The Twin region an anatomical structure belongs to, or null when it is not a
 * muscle this app tracks.
 *
 * @param {string} name anatomical name as BodyParts3D spells it
 * @returns {string | null}
 */
export function regionForMuscle(name) {
  const clean = String(name ?? "").trim();
  if (!clean || NOT_MUSCLE.test(clean)) return null;
  for (const [region, pattern] of REGION_PATTERNS) {
    if (pattern.test(clean)) return region;
  }
  return null;
}
