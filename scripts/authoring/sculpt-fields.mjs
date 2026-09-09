/** Generic art-direction landmarks, in metres on the pinned native candidate.
 * These are presentation lobes, not patient segmentation or measured anatomy.
 * Mirrors share the same recipe; face/hands/feet and central pelvis are protected.
 */
const lobe = (name, region, centre, radii, lift, angle = 0) => ({
  name,
  region,
  centre,
  radii,
  lift,
  angle: (angle * Math.PI) / 180,
});
export const SCULPT_LOBES = [
  lobe("pectoral", "chest", [0.084, 1.412, 0.135], [0.093, 0.104, 0.075], 0.008, -9),
  lobe("anterior-deltoid", "shoulders", [0.201, 1.467, 0.105], [0.043, 0.092, 0.065], 0.005, 19),
  lobe("lateral-deltoid", "shoulders", [0.242, 1.459, 0.033], [0.04, 0.097, 0.086], 0.007, 19),
  lobe("posterior-deltoid", "shoulders", [0.207, 1.466, -0.039], [0.052, 0.087, 0.052], 0.005, 16),
  lobe("biceps", "arms", [0.259, 1.299, 0.064], [0.042, 0.126, 0.047], 0.006, 21),
  lobe("triceps", "arms", [0.257, 1.298, -0.022], [0.041, 0.133, 0.048], 0.005, 20),
  lobe("forearm-flexors", "arms", [0.296, 1.105, 0.055], [0.023, 0.127, 0.043], 0.003, 15),
  lobe("forearm-extensors", "arms", [0.33, 1.098, 0.015], [0.025, 0.131, 0.044], 0.003, 12),
  lobe("rectus-upper", "abs", [0.037, 1.281, 0.134], [0.034, 0.036, 0.045], 0.0045),
  lobe("rectus-middle", "abs", [0.037, 1.203, 0.136], [0.035, 0.035, 0.046], 0.005),
  lobe("rectus-lower", "abs", [0.037, 1.126, 0.127], [0.033, 0.035, 0.047], 0.004),
  lobe("oblique", "core", [0.109, 1.184, 0.095], [0.039, 0.132, 0.06], 0.0035, -14),
  lobe("serratus", "core", [0.139, 1.307, 0.075], [0.032, 0.065, 0.06], 0.003, 24),
  lobe("trapezius", "back", [0.066, 1.473, -0.054], [0.068, 0.076, 0.041], 0.004, -28),
  lobe("latissimus", "back", [0.121, 1.302, -0.062], [0.061, 0.159, 0.045], 0.005, -14),
  lobe("erector", "back", [0.042, 1.223, -0.063], [0.028, 0.129, 0.044], 0.003),
  lobe("gluteal", "glutes", [0.1, 0.984, -0.068], [0.069, 0.113, 0.047], 0.0035, -5),
  lobe("rectus-femoris", "legs", [0.12, 0.802, 0.106], [0.038, 0.196, 0.069], 0.008, 5),
  lobe("vastus-lateralis", "legs", [0.175, 0.804, 0.045], [0.039, 0.215, 0.085], 0.008, 9),
  lobe("vastus-medialis", "legs", [0.073, 0.663, 0.069], [0.036, 0.114, 0.063], 0.006, -12),
  lobe("hamstring-lateral", "legs", [0.158, 0.78, -0.035], [0.041, 0.197, 0.044], 0.006, 6),
  lobe("hamstring-medial", "legs", [0.08, 0.786, -0.024], [0.037, 0.174, 0.044], 0.0045, 6),
  lobe("calf-medial", "legs", [0.122, 0.376, -0.045], [0.038, 0.155, 0.054], 0.008, -6),
  lobe("calf-lateral", "legs", [0.178, 0.358, -0.025], [0.033, 0.153, 0.055], 0.006, 6),
  lobe("tibialis", "legs", [0.164, 0.333, 0.04], [0.023, 0.169, 0.034], 0.002, -3),
];
export const SCULPT_MAX_DISPLACEMENT_M = 0.012;
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function protection([x, y]) {
  const hands = 1 - smooth(0.305, 0.322, Math.abs(x)) * (1 - smooth(0.97, 1.025, y));
  const pelvis =
    1 -
    (1 - smooth(0.045, 0.077, Math.abs(x))) * smooth(0.88, 0.94, y) * (1 - smooth(1.005, 1.055, y));
  return smooth(0.12, 0.18, y) * (1 - smooth(1.56, 1.585, y)) * hands * pelvis;
}
export function sampleLobe(position, guide) {
  const dx = Math.abs(position[0]) - guide.centre[0];
  const dy = position[1] - guide.centre[1];
  const dz = position[2] - guide.centre[2];
  const c = Math.cos(guide.angle),
    s = Math.sin(guide.angle);
  const across = c * dx + s * dy;
  const along = -s * dx + c * dy;
  const r2 =
    (across / guide.radii[0]) ** 2 + (along / guide.radii[1]) ** 2 + (dz / guide.radii[2]) ** 2;
  const envelope = Math.max(0, 1 - r2);
  return { envelope, across, along };
}
export function sculptAt(position, region) {
  let lift = 0,
    tint = 0,
    best = null;
  for (const guide of SCULPT_LOBES) {
    const sample = sampleLobe(position, guide);
    // Max, not sum: overlapping art fields cannot accumulate unbounded inflation.
    lift = Math.max(lift, sample.envelope ** 2 * guide.lift);
    if (guide.region === region && sample.envelope > tint) {
      tint = sample.envelope;
      best = { guide, ...sample };
    }
  }
  const protect = protection(position);
  const mask = smooth(0.02, 0.32, tint) * protect;
  const fiberPhase = best
    ? region === "chest" || region === "abs"
      ? (position[1] + 0.65 * (Math.abs(position[0]) - best.guide.centre[0]) ** 2) * 3.2
      : best.across * 3.2
    : position[1] * 3.2;
  return { lift: Math.min(lift * protect, SCULPT_MAX_DISPLACEMENT_M), mask, fiberPhase };
}
