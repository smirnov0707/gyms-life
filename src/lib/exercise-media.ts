import { EXERCISE_CLIP_BY_SLUG } from "./exercise-clips";

const url = (name: string) => `/assets/videos/${name}`;
const ai = (name: string) => `/assets/ai/${name}`;

/** Technique clip (mp4) that matches the exercise name exactly, if we have one. */
function catalogueClip(slug?: string | null): string | null {
  const s = (slug ?? "").toLowerCase();
  if (!s) return null;
  const direct = EXERCISE_CLIP_BY_SLUG[s];
  if (direct) return `/assets/exdb/${direct}.mp4`;
  const base = baseExerciseSlug(s);
  const viaBase = base ? EXERCISE_CLIP_BY_SLUG[base] : undefined;
  if (viaBase) return `/assets/exdb/${viaBase}.mp4`;
  return nearestCatalogueClip(base ?? s);
}

/**
 * Plans can name exercises that are not in the catalogue. We pick the clip
 * whose slug shares the most words, so the demo still shows that movement.
 */
function nearestCatalogueClip(slug: string): string | null {
  const words = new Set(slug.split("-").filter(Boolean));
  if (!words.size) return null;
  let bestScore = 0;
  let bestFile: string | null = null;
  for (const [key, file] of Object.entries(EXERCISE_CLIP_BY_SLUG)) {
    const other = new Set(key.split("-"));
    let shared = 0;
    for (const w of words) if (other.has(w)) shared++;
    const score = shared / new Set([...words, ...other]).size;
    if (score > bestScore) {
      bestScore = score;
      bestFile = file;
    }
  }
  return bestScore >= 0.5 && bestFile ? `/assets/exdb/${bestFile}.mp4` : null;
}



/* Locally stored technique clips */
const squat = url("exercise-squat.mp4");
const pushup = url("exercise-pushup.mp4");
const deadlift = url("exercise-deadlift.mp4");
const plank = url("exercise-plank.mp4");
const kettlebell = url("exercise-kettlebell.mp4");
const lunge = url("exercise-lunge.mp4");
const pullup = url("exercise-pullup.mp4");
const bench = url("exercise-bench.mp4");
const burpee = url("exercise-burpee.mp4");
const gluteBridge = url("exercise-glute-bridge.mp4");

/* AI-generated technique clips (CDN assets) */
const row = "/__l5e/assets-v1/980bbb09-0d57-401f-8628-c6e231a331ec/pat-barbell-row.mp4";
const ohp = "/__l5e/assets-v1/06f729f1-560c-49ac-824a-3ee2c995316f/pat-overhead-press.mp4";
const curl = "/__l5e/assets-v1/b36c454e-b6c7-42dd-b93b-cc3c119b1f5a/pat-dumbbell-curl.mp4";
const pushdown = "/__l5e/assets-v1/5b6da8e5-9e8f-4cd7-9ba4-531335e7d681/pat-cable-pushdown.mp4";
const pulldown = "/__l5e/assets-v1/5ea2c031-ab0b-446c-8c66-eb26ec7ed747/pat-lat-pulldown.mp4";
const legPress = "/__l5e/assets-v1/78e73890-19b3-4d7f-917c-dbd458fe95cd/pat-leg-press.mp4";
const lateralRaise = "/__l5e/assets-v1/65ec35a6-df0c-4f30-8f93-2423454979ca/pat-lateral-raise.mp4";
const band = "/__l5e/assets-v1/8b2b03e2-61b7-4821-895c-b0e0ad046fff/pat-band.mp4";
const dbBench = "/__l5e/assets-v1/81e8cf43-5988-45ef-9f2d-1888aeed9c47/pat-db-bench.mp4";
const trx = "/__l5e/assets-v1/70f54860-5a4c-45cc-9380-2b6daa00299d/pat-trx.mp4";
const ball = "/__l5e/assets-v1/75640292-679a-4c41-8b1f-3948c6a27327/pat-ball.mp4";
const cardio = "/__l5e/assets-v1/54dd9c07-e4e0-48a8-9086-c965c3ca5d8b/pat-cardio.mp4";
const mobilityClip = "/__l5e/assets-v1/5c204aa9-8af0-450f-8015-a5e95f6217cb/pat-mobility.mp4";
const hipThrust = "/__l5e/assets-v1/87e3f4a2-faaf-432b-bce8-3c375e8da64a/pat-hip-thrust.mp4";
const calfRaise = "/__l5e/assets-v1/872bdbe6-c9aa-4a65-a996-696e1168dc34/pat-calf-raise.mp4";
const fly = "/__l5e/assets-v1/e0c71606-32aa-471f-bdb0-adb9c3be2bbb/pat-cable-fly.mp4";
const crunch = "/__l5e/assets-v1/00fbeed0-205f-4685-be3c-161f886315d0/pat-crunch.mp4";
const bicycleCrunch = "/__l5e/assets-v1/14945fe7-4038-46a2-9096-598ddba066cd/pat-bicycle-crunch.mp4";
const hangingLegRaise = "/__l5e/assets-v1/5477749f-b63d-41fc-bbcc-ff103ebec2d1/pat-hanging-leg-raise.mp4";
const russianTwist = "/__l5e/assets-v1/c5319aab-bd32-49d0-9988-9e553b245906/pat-russian-twist.mp4";
const mountainClimber = "/__l5e/assets-v1/75569c8d-ef28-4b2a-9d9f-01d27f7d2701/pat-mountain-climber.mp4";
const abWheel = "/__l5e/assets-v1/161fb48f-1cbc-4ef1-95bd-0b348c70ab26/pat-ab-wheel.mp4";
const legExtension = "/__l5e/assets-v1/1630a9ae-e9f9-413f-a5e6-5e1625ea08a2/pat-leg-extension.mp4";
const legCurl = "/__l5e/assets-v1/3d0da02d-0cbd-45a0-88bc-c897d0b38a43/pat-leg-curl.mp4";
const backExtension = "/__l5e/assets-v1/4a6f381d-d43b-45e1-894d-badf8372c175/pat-back-extension.mp4";
const shrug = "/__l5e/assets-v1/3a5c8206-cccf-4f80-a4a7-13445b1e43a1/pat-shrug.mp4";
const facePull = "/__l5e/assets-v1/21dc880e-9b65-4fb7-bda5-a597f1598b86/pat-face-pull.mp4";
const seatedRow = "/__l5e/assets-v1/8067e461-3599-46bd-b3cb-5285e6ba57d8/pat-seated-row.mp4";
const dbShoulderPress = "/__l5e/assets-v1/a427b2a2-3f4f-4fb3-9422-33a82a3616c3/pat-db-shoulder-press.mp4";
const dip = "/__l5e/assets-v1/9f342b03-07bf-44f0-a486-bfd7ec50112e/pat-dip.mp4";
const jumpRope = "/__l5e/assets-v1/a66ed4e2-165c-47a4-bacb-d2a4f01cbd68/pat-jump-rope.mp4";
const boxJump = "/__l5e/assets-v1/10aa7720-45cf-46ac-8de8-ce6cdb0637c0/pat-box-jump.mp4";
const rowErg = "/__l5e/assets-v1/8b59d740-a5e3-4377-bafa-0e1cfa243261/pat-row-erg.mp4";
const treadmill = "/__l5e/assets-v1/4a167aa1-b5a6-46a3-8cfc-25f99c750da3/pat-treadmill.mp4";
const gluteKickback = "/__l5e/assets-v1/1dce31f7-bfe9-4a44-9ad7-3234a005205f/pat-glute-kickback.mp4";
const deadBug = "/__l5e/assets-v1/de590840-3b52-4843-a03d-c56b8ac0c595/pat-dead-bug.mp4";
const wallSit = "/__l5e/assets-v1/ce1264c4-171e-4163-9d3d-71aad9ae8272/pat-wall-sit.mp4";
const stepUp = "/__l5e/assets-v1/633be111-bb03-4320-a3fd-378f2f42a202/pat-step-up.mp4";

/**
 * Explicit clip for every exercise in the catalogue — the demo always shows
 * the movement named on the card (bicycle crunch shows a bicycle crunch, etc.).
 */
const bySlug: Record<string, string> = {
  "ab-wheel": abWheel,
  "abductor-machine": hipThrust,
  "adductor-machine": legPress,
  "archer-push-up": pushup,
  "arnold-press": dbShoulderPress,
  "assault-bike": cardio,
  "band-chest-press": band,
  "band-curl": curl,
  "band-glute-kickback": gluteKickback,
  "band-hip-thrust": hipThrust,
  "band-lateral-walk": band,
  "band-leg-curl": legCurl,
  "band-pull-apart": facePull,
  "band-pulldown": pulldown,
  "band-squat": squat,
  "band-triceps-extension": pushdown,
  "barbell-calf-raise": calfRaise,
  "barbell-curl": curl,
  "barbell-lunge": lunge,
  "barbell-row": row,
  "barbell-shrug": shrug,
  "barbell-step-up": stepUp,
  "battle-ropes": cardio,
  "bear-crawl": mountainClimber,
  "bench-dip": dip,
  "bench-press": bench,
  "bicep-curl": curl,
  "bicycle-crunch": bicycleCrunch,
  "bird-dog": deadBug,
  "bodyweight-squat": squat,
  "box-jump": boxJump,
  "box-squat": squat,
  "burpee": burpee,
  "cable-crossover": fly,
  "cable-crunch": crunch,
  "cable-curl": curl,
  "cable-fly": fly,
  "cable-kickback": gluteKickback,
  "cable-lateral-raise": lateralRaise,
  "calf-raise": calfRaise,
  "captains-chair-raise": hangingLegRaise,
  "cat-cow": mobilityClip,
  "chest-dip": dip,
  "chest-press-machine": dbBench,
  "chest-supported-row": row,
  "chin-up": pullup,
  "clean-and-press": ohp,
  "close-grip-bench-press": bench,
  "close-grip-pulldown": pulldown,
  "close-grip-push-up": pushup,
  "concentration-curl": curl,
  "cossack-squat": squat,
  "couch-stretch": mobilityClip,
  "db-bulgarian-split-squat": lunge,
  "db-calf-raise": calfRaise,
  "db-fly": fly,
  "db-hip-thrust": hipThrust,
  "db-incline-press": dbBench,
  "db-pullover": fly,
  "db-romanian-deadlift": deadlift,
  "db-shoulder-press": dbShoulderPress,
  "db-shrug": shrug,
  "db-step-up": stepUp,
  "db-sumo-squat": squat,
  "db-walking-lunge": lunge,
  "dead-bug": deadBug,
  "dead-hang": pullup,
  "deadlift": deadlift,
  "decline-bench-press": bench,
  "decline-push-up": pushup,
  "diamond-push-up": pushup,
  "dragon-flag": crunch,
  "dumbbell-press": dbBench,
  "elliptical": cardio,
  "ez-bar-curl": curl,
  "face-pull": facePull,
  "farmers-carry": kettlebell,
  "foam-roll-quads": mobilityClip,
  "frog-pump": gluteBridge,
  "front-raise": lateralRaise,
  "front-squat": squat,
  "glute-bridge": gluteBridge,
  "glute-machine": hipThrust,
  "goblet-squat": squat,
  "good-morning": deadlift,
  "hack-squat": legPress,
  "hammer-curl": curl,
  "handstand-hold": pushup,
  "hanging-leg-raise": hangingLegRaise,
  "high-knees": cardio,
  "hip-flexor-stretch": mobilityClip,
  "hip-thrust": hipThrust,
  "hollow-hold": deadBug,
  "hyperextension": backExtension,
  "incline-bench-press": bench,
  "incline-db-curl": curl,
  "inverted-row": trx,
  "jump-rope": jumpRope,
  "jump-squat": squat,
  "jumping-jack": cardio,
  "kb-clean": kettlebell,
  "kb-deadlift": kettlebell,
  "kb-front-rack-squat": squat,
  "kb-lunge": lunge,
  "kb-snatch": kettlebell,
  "kb-turkish-get-up": kettlebell,
  "kettlebell-swing": kettlebell,
  "landmine-press": ohp,
  "lat-pulldown": pulldown,
  "lateral-raise": lateralRaise,
  "leg-curl": legCurl,
  "leg-extension": legExtension,
  "leg-press": legPress,
  "lunge": lunge,
  "machine-row": seatedRow,
  "med-ball-slam": ball,
  "med-ball-twist": russianTwist,
  "mountain-climber": mountainClimber,
  "neutral-grip-pull-up": pullup,
  "one-arm-db-row": row,
  "overhead-press": ohp,
  "overhead-triceps-extension": pushdown,
  "pallof-press": plank,
  "pause-squat": squat,
  "pec-deck": fly,
  "pendlay-row": row,
  "pike-push-up": pushup,
  "pistol-squat": squat,
  "plank": plank,
  "plank-shoulder-tap": plank,
  "preacher-curl": curl,
  "pull-up": pullup,
  "push-up": pushup,
  "rack-pull": deadlift,
  "rear-delt-fly": facePull,
  "reverse-lunge": lunge,
  "romanian-deadlift": deadlift,
  "rope-pushdown": pushdown,
  "rowing-machine": rowErg,
  "russian-twist": russianTwist,
  "seated-cable-row": seatedRow,
  "seated-calf-raise": calfRaise,
  "shoulder-press-machine": dbShoulderPress,
  "side-plank": plank,
  "single-leg-glute-bridge": gluteBridge,
  "sit-up": crunch,
  "ski-erg": rowErg,
  "skullcrusher": pushdown,
  "sled-push": cardio,
  "smith-squat": squat,
  "squat": squat,
  "stair-climber": cardio,
  "straight-arm-pulldown": pulldown,
  "sumo-deadlift": deadlift,
  "superman": backExtension,
  "t-bar-row": row,
  "thoracic-rotation": mobilityClip,
  "thruster": squat,
  "toes-to-bar": hangingLegRaise,
  "treadmill-sprint": treadmill,
  "tricep-dip": dip,
  "triceps-pushdown": pushdown,
  "trx-fallout": trx,
  "trx-pistol": trx,
  "trx-push-up": trx,
  "trx-row": trx,
  "upright-row": lateralRaise,
  "v-up": crunch,
  "wall-ball": ball,
  "wall-sit": wallSit,
  "wide-grip-pulldown": pulldown,
  "wide-push-up": pushup,
  "worlds-greatest-stretch": mobilityClip,
  "wrist-curl": curl,
  "zercher-squat": squat,
};

/**
 * Slugs whose clip really shows that exact movement. Anything else resolves to
 * an approximate pattern clip, so the UI shows an illustration instead of a
 * video that contradicts the exercise name.
 */
const EXACT_CLIP_SLUGS = new Set<string>([
  "ab-wheel",
  "hyperextension",
  "band-chest-press",
  "barbell-row",
  "pendlay-row",
  "bicycle-crunch",
  "box-jump",
  "cable-fly",
  "cable-crossover",
  "triceps-pushdown",
  "rope-pushdown",
  "calf-raise",
  "barbell-calf-raise",
  "db-calf-raise",
  "sit-up",
  "dumbbell-press",
  "db-shoulder-press",
  "dead-bug",
  "chest-dip",
  "tricep-dip",
  "bicep-curl",
  "face-pull",
  "cable-kickback",
  "hanging-leg-raise",
  "hip-thrust",
  "jump-rope",
  "lat-pulldown",
  "wide-grip-pulldown",
  "lateral-raise",
  "leg-curl",
  "leg-extension",
  "leg-press",
  "hip-flexor-stretch",
  "mountain-climber",
  "overhead-press",
  "rowing-machine",
  "russian-twist",
  "med-ball-twist",
  "seated-cable-row",
  "machine-row",
  "barbell-shrug",
  "db-step-up",
  "treadmill-sprint",
  "trx-row",
  "wall-sit",
  "squat",
  "push-up",
  "wide-push-up",
  "deadlift",
  "plank",
  "kettlebell-swing",
  "lunge",
  "db-walking-lunge",
  "pull-up",
  "bench-press",
  "burpee",
  "glute-bridge",
]);

/** True when a technique clip exists that matches the exercise name exactly. */
export function exerciseClipIsExact(slug?: string | null): boolean {
  const s = (slug ?? "").toLowerCase();
  if (!s) return false;
  if (catalogueClip(s)) return true;
  if (EXACT_CLIP_SLUGS.has(s)) return true;
  const base = baseExerciseSlug(s);
  return !!base && EXACT_CLIP_SLUGS.has(base);
}



/** Variation prefixes used by the extended catalogue (single-arm squat, tempo bench…). */
const VARIATION_PREFIXES = [
  "tempo", "paused", "single-arm", "single-leg", "banded", "deficit", "pulse",
  "isometric", "explosive", "eccentric", "1-5-rep", "wide-stance", "close-stance",
  "weighted", "slow-negative", "cluster-set", "drop-set", "superset", "amrap",
];

export function baseExerciseSlug(slug?: string | null) {
  if (!slug) return null;
  let s = slug;
  for (const p of VARIATION_PREFIXES) {
    if (s.startsWith(`${p}-`)) {
      s = s.slice(p.length + 1);
      break;
    }
  }
  return s;
}

const has = (s: string, ...words: string[]) => {
  const tokens = s.split("-");
  return words.some((w) =>
    w.includes("-") ? s.includes(w) : tokens.some((tk) => tk === w || tk.startsWith(w)),
  );
};

/**
 * Returns the technique clip for the exercise. Catalogue slugs resolve to
 * their own dedicated demo; unknown slugs fall back to the closest
 * movement-pattern clip by wording, equipment and muscle group.
 */
export function exerciseVideo(
  slug?: string | null,
  muscleGroup?: string | null,
  equipment?: string | null,
): string {
  const s = (slug ?? "").toLowerCase();
  const base = baseExerciseSlug(s);
  const catalogue = catalogueClip(s);
  if (catalogue) return catalogue;
  if (s && bySlug[s]) return bySlug[s]!;
  if (base && bySlug[base]) return bySlug[base]!;


  const mg = (muscleGroup ?? "").toLowerCase();
  const eq = (equipment ?? "").toLowerCase();

  if (mg === "mobility" || has(s, "stretch", "foam-roll", "cat-cow", "mobility")) return mobilityClip;
  if (has(s, "burpee")) return burpee;
  if (has(s, "jump-rope", "skipping")) return jumpRope;
  if (has(s, "treadmill", "run", "sprint")) return treadmill;
  if (has(s, "row-erg", "rowing-machine", "ski-erg")) return rowErg;
  if (mg === "cardio" || eq === "cardio" || has(s, "bike", "elliptical", "jack", "skater", "stair")) return cardio;
  if (has(s, "bicycle")) return bicycleCrunch;
  if (has(s, "twist")) return russianTwist;
  if (has(s, "crunch", "sit-up", "v-up")) return crunch;
  if (has(s, "hanging", "toes-to-bar")) return hangingLegRaise;
  if (has(s, "mountain-climber", "bear-crawl")) return mountainClimber;
  if (has(s, "ab-wheel", "rollout")) return abWheel;
  if (has(s, "dead-bug", "bird-dog", "hollow")) return deadBug;
  if (has(s, "plank", "pallof")) return plank;
  if (has(s, "wall-sit")) return wallSit;
  if (has(s, "calf")) return calfRaise;
  if (has(s, "kickback", "clamshell", "donkey")) return gluteKickback;
  if (has(s, "hip-thrust", "abduction")) return hipThrust;
  if (has(s, "bridge", "frog")) return gluteBridge;
  if (has(s, "swing", "snatch", "clean", "turkish", "carry", "kb-")) return kettlebell;
  if (has(s, "hyperextension", "back-extension", "superman")) return backExtension;
  if (has(s, "deadlift", "rdl", "good-morning", "pull-through")) return deadlift;
  if (has(s, "leg-extension")) return legExtension;
  if (has(s, "leg-curl")) return legCurl;
  if (has(s, "leg-press", "hack", "adductor")) return legPress;
  if (has(s, "step-up", "box-step")) return stepUp;
  if (has(s, "box-jump")) return boxJump;
  if (has(s, "squat")) return squat;
  if (has(s, "lunge", "split-squat")) return lunge;
  if (has(s, "push-up", "pushup")) return pushup;
  if (has(s, "dip")) return dip;
  if (has(s, "fly", "crossover", "pec-deck", "pullover")) return fly;
  if (has(s, "bench-press", "chest-press", "incline-press", "decline-press", "floor-press"))
    return eq === "barbell" ? bench : dbBench;
  if (has(s, "pull-up", "pullup", "chin-up", "hang", "muscle-up")) return pullup;
  if (has(s, "pulldown", "pull-down")) return pulldown;
  if (has(s, "shrug")) return shrug;
  if (has(s, "face-pull", "pull-apart", "rear-delt")) return facePull;
  if (has(s, "row")) return eq === "trx" ? trx : eq === "machine" || eq === "cable" ? seatedRow : row;
  if (has(s, "curl")) return curl;
  if (has(s, "pushdown", "skull", "triceps", "overhead-extension")) return pushdown;
  if (has(s, "lateral-raise", "front-raise", "upright-row")) return lateralRaise;
  if (has(s, "press", "jerk")) return mg === "chest" ? dbBench : mg === "shoulders" ? dbShoulderPress : ohp;

  if (mg === "abs" || mg === "core") return eq === "ball" ? ball : eq === "pullup_bar" ? hangingLegRaise : plank;
  if (eq === "trx") return trx;
  if (eq === "ball") return ball;
  if (eq === "band") return band;
  if (eq === "kettlebell") return kettlebell;
  if (eq === "pullup_bar") return pullup;
  if (eq === "cable") return mg === "chest" ? fly : mg === "back" ? seatedRow : pushdown;
  if (eq === "machine")
    return mg === "legs" || mg === "glutes" ? legPress : mg === "chest" ? dbBench : mg === "shoulders" ? dbShoulderPress : pulldown;
  if (eq === "barbell")
    return mg === "chest" ? bench : mg === "back" ? row : mg === "shoulders" ? ohp : mg === "arms" ? curl : squat;
  if (eq === "dumbbell")
    return mg === "chest" ? dbBench : mg === "back" ? row : mg === "shoulders" ? dbShoulderPress : mg === "legs" ? lunge : curl;
  if (eq === "bodyweight")
    return mg === "chest" || mg === "arms" ? pushup : mg === "back" ? pullup : mg === "legs" ? squat : plank;

  if (mg === "chest") return dbBench;
  if (mg === "back") return row;
  if (mg === "shoulders") return ohp;
  if (mg === "arms") return curl;
  if (mg === "legs") return squat;
  if (mg === "glutes") return hipThrust;
  if (mg === "fullbody") return burpee;
  return squat;
}

/** AI-generated movement visuals, picked by equipment + trained body part. */
const AI_IMAGES = {
  barbellLegs: ai("ex-barbell-legs.jpg"),
  barbellChest: ai("ex-barbell-chest.jpg"),
  barbellBack: ai("ex-barbell-back.jpg"),
  barbellShoulders: ai("ex-barbell-shoulders.jpg"),
  dumbbellArms: ai("ex-dumbbell-arms.jpg"),
  dumbbellChest: ai("ex-dumbbell-chest.jpg"),
  dumbbellLegs: ai("ex-dumbbell-legs.jpg"),
  dumbbellBack: ai("ex-dumbbell-back.jpg"),
  dumbbellShoulders: ai("ex-dumbbell-shoulders.jpg"),
  kettlebell: ai("ex-kettlebell.jpg"),
  band: ai("ex-band.jpg"),
  machineLegs: ai("ex-machine-legs.jpg"),
  machineBack: ai("ex-machine-back.jpg"),
  cable: ai("ex-cable.jpg"),
  bodyweightCore: ai("ex-bodyweight-core.jpg"),
  bodyweightChest: ai("ex-bodyweight-chest.jpg"),
  bodyweightLegs: ai("ex-bodyweight-legs.jpg"),
  bar: ai("ex-bar.jpg"),
  cardio: ai("ex-cardio.jpg"),
  glutes: ai("ex-glutes.jpg"),
  trx: ai("ex-trx.jpg"),
  ball: ai("ex-ball.jpg"),
  mobility: ai("ex-mobility.jpg"),
  fallback: ai("ex-default.jpg"),
} as const;

/**
 * Returns an AI-generated illustration that matches the exercise's
 * equipment and target muscle group.
 */
export function exerciseImage(
  slug?: string | null,
  muscleGroup?: string | null,
  equipment?: string | null,
): string {
  const mg = (muscleGroup ?? "").toLowerCase();
  const eq = (equipment ?? "").toLowerCase();
  const s = (slug ?? "").toLowerCase();

  if (mg === "mobility" || s.includes("stretch") || s.includes("foam-roll")) return AI_IMAGES.mobility;
  if (eq === "cardio" || mg === "cardio") return AI_IMAGES.cardio;
  if (eq === "trx") return AI_IMAGES.trx;
  if (eq === "ball") return AI_IMAGES.ball;
  if (eq === "band") return AI_IMAGES.band;
  if (eq === "kettlebell") return AI_IMAGES.kettlebell;
  if (eq === "pullup_bar") return AI_IMAGES.bar;
  if (mg === "glutes") return AI_IMAGES.glutes;

  if (eq === "barbell") {
    if (mg === "chest") return AI_IMAGES.barbellChest;
    if (mg === "back") return AI_IMAGES.barbellBack;
    if (mg === "shoulders") return AI_IMAGES.barbellShoulders;
    if (mg === "arms") return AI_IMAGES.dumbbellArms;
    return AI_IMAGES.barbellLegs;
  }
  if (eq === "dumbbell") {
    if (mg === "chest") return AI_IMAGES.dumbbellChest;
    if (mg === "back") return AI_IMAGES.dumbbellBack;
    if (mg === "shoulders") return AI_IMAGES.dumbbellShoulders;
    if (mg === "legs") return AI_IMAGES.dumbbellLegs;
    return AI_IMAGES.dumbbellArms;
  }
  if (eq === "cable") return AI_IMAGES.cable;
  if (eq === "machine") {
    if (mg === "legs") return AI_IMAGES.machineLegs;
    return AI_IMAGES.machineBack;
  }
  if (eq === "bodyweight") {
    if (mg === "chest" || mg === "arms") return AI_IMAGES.bodyweightChest;
    if (mg === "legs") return AI_IMAGES.bodyweightLegs;
    if (mg === "back") return AI_IMAGES.bar;
    return AI_IMAGES.bodyweightCore;
  }

  if (mg === "core" || mg === "abs") return AI_IMAGES.bodyweightCore;
  if (mg === "chest") return AI_IMAGES.dumbbellChest;
  if (mg === "back") return AI_IMAGES.machineBack;
  if (mg === "legs") return AI_IMAGES.bodyweightLegs;
  return AI_IMAGES.fallback;
}

/**
 * Poster frame grabbed directly from the exercise's own technique clip, so a
 * card thumbnail always shows the exact movement that will play.
 */
export function exerciseVideoPoster(
  slug?: string | null,
  muscleGroup?: string | null,
  equipment?: string | null,
): string {
  const video = exerciseVideo(slug, muscleGroup, equipment);
  const file = video.split("/").pop() ?? "";
  if (video.startsWith("/assets/exdb/")) return `/assets/exdb/posters/${file.replace(/\.mp4$/, ".jpg")}`;
  if (file.endsWith(".mp4")) return `/assets/posters/${file.replace(/\.mp4$/, ".jpg")}`;
  return exerciseImage(slug, muscleGroup, equipment);
}

