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
    // Upper arm and forearm alike. Without the forearm group the arms ended
    // at the elbow and the rest was bare silhouette, which on a screen about
    // training is half an arm.
    //
    // The digitorum group is spelled out rather than wildcarded. "Extensor
    // digitorum" is a forearm muscle, but "extensor digitorum longus" and
    // "flexor digitorum longus|brevis" are the shin and the sole of the foot:
    // a pattern that accepted any suffix put the athlete's arm recovery on
    // their feet, and the figure showed it — green feet under blue legs.
    //
    // The intrinsic muscles of the hand are left out on purpose. They are the
    // width of a finger, invisible at any zoom the app allows, and the skin is
    // drawn wherever no muscle lies under it — so leaving them out is what
    // keeps the figure's hands hands, rather than a flayed palm.
    /^(right |left )?(.*head of )?(right |left )?(biceps brachii|triceps brachii|brachialis|brachioradialis|coracobrachialis|anconeus|pronator (teres|quadratus)|supinator|palmaris longus|(extensor|flexor) carpi (radialis|ulnaris)( longus| brevis)?|extensor digitorum|flexor digitorum (superficialis|profundus)|extensor (digiti minimi|indicis)|(extensor|abductor|flexor) pollicis longus|extensor pollicis brevis)$/i,
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
    // Thigh and shin. The shin group is here rather than left out: it is what
    // the calf raise and the ankle work land on, and without it the figure
    // ends at the knee. The intrinsic muscles of the foot are left out for
    // the same reason as the hand's — the sole is skin on this figure.
    /^(right |left )?(.*head of )?(right |left )?(rectus femoris|vastus (lateralis|medialis|intermedius)|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|soleus|plantaris|popliteus|sartorius|gracilis|adductor (magnus|longus|brevis)|tensor fasciae latae|tibialis (anterior|posterior)|peroneus (longus|brevis|tertius)|iliopsoas|psoas major|(extensor|flexor) digitorum longus|(extensor|flexor) hallucis longus)$/i,
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
