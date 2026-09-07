import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
} from "three";

/**
 * The stage the figure stands on: a lit platform ring, the dashed rings behind
 * it, a field of particles and a floor grid.
 *
 * None of it carries a reading. It exists because a body alone on a flat black
 * page reads as a model sheet rather than as an instrument — the screen it is
 * drawn from puts the figure inside a lit apparatus, and without that the
 * figure looks like it is floating in nothing. Everything here is decoration
 * and says so: no part of it changes with the athlete's data.
 *
 * Built from primitives rather than a texture so it stays sharp at every zoom
 * the camera allows, and drawn with additive blending so it glows on the dark
 * stage instead of sitting on it as paint.
 */

/** Cyan, the colour of the apparatus rather than of any state. */
const STAGE_COLOUR = 0x2ad4ff;
const STAGE_DEEP = 0x1b7fd4;

/**
 * How wide the platform is, in metres. Sized to the figure's stance rather
 * than to the stage: a wider ring is the first thing the camera crops, and a
 * ring with its far side cut off reads as a mistake rather than as a platform.
 */
const PLATFORM_INNER = 0.26;
const PLATFORM_OUTER = 0.33;

export type TwinStageDecor = {
  group: Group;
  dispose(): void;
};

/** A soft radial glow, brightest at the given stop, as a texture. */
function glowTexture(stop: number, alpha: number): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(stop, `rgba(255,255,255,${alpha * 0.35})`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** One horizontal ring of light, lying on the floor. */
function platformRing(inner: number, outer: number, colour: number, opacity: number): Mesh {
  const ring = new Mesh(
    new RingGeometry(inner, outer, 96),
    new MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/**
 * A dashed circle standing upright behind the figure, as line segments.
 *
 * `gap` is the fraction of each step left unlit, so the dashes read at any
 * radius rather than getting longer as the circle grows.
 */
function dashedCircle(radius: number, steps: number, gap: number, colour: number, opacity: number) {
  const points: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const from = (i / steps) * Math.PI * 2;
    const to = from + ((1 - gap) / steps) * Math.PI * 2;
    points.push(
      Math.cos(from) * radius,
      Math.sin(from) * radius,
      0,
      Math.cos(to) * radius,
      Math.sin(to) * radius,
      0,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/**
 * A radial floor grid: rings and spokes, fading out with distance.
 *
 * Drawn as one set of segments rather than a texture so it has no resolution
 * to run out of when the athlete zooms in on a foot.
 */
function floorGrid(rings: number, spokes: number, radius: number) {
  const points: number[] = [];
  const colours: number[] = [];
  const near = new Color(STAGE_COLOUR);
  const far = new Color(0x0a1622);
  for (let r = 1; r <= rings; r += 1) {
    const at = (r / rings) * radius;
    const shade = near.clone().lerp(far, r / rings);
    for (let i = 0; i < 96; i += 1) {
      const from = (i / 96) * Math.PI * 2;
      const to = ((i + 1) / 96) * Math.PI * 2;
      points.push(Math.cos(from) * at, 0, Math.sin(from) * at);
      points.push(Math.cos(to) * at, 0, Math.sin(to) * at);
      colours.push(shade.r, shade.g, shade.b, shade.r, shade.g, shade.b);
    }
  }
  for (let s = 0; s < spokes; s += 1) {
    const angle = (s / spokes) * Math.PI * 2;
    points.push(Math.cos(angle) * (radius / rings), 0, Math.sin(angle) * (radius / rings));
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    colours.push(near.r, near.g, near.b, far.r, far.g, far.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/**
 * Particles standing in the air around the figure.
 *
 * Placed with a fixed sequence rather than Math.random, so the stage is the
 * same every time it mounts: a field that reshuffles on every render looks
 * like something is happening, and nothing is.
 */
function particles(count: number, texture: CanvasTexture | null) {
  const points = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  // A low-discrepancy sequence: evenly spread without looking like a lattice.
  let seed = 20260907;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const angle = next() * Math.PI * 2;
    const radius = 0.75 + next() * 1.9;
    points[i * 3] = Math.cos(angle) * radius;
    points[i * 3 + 1] = next() * 2.4 - 0.15;
    points[i * 3 + 2] = Math.sin(angle) * radius;
    sizes[i] = 0.008 + next() * 0.016;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(points, 3));
  geometry.setAttribute("size", new BufferAttribute(sizes, 1));
  return new Points(
    geometry,
    new PointsMaterial({
      color: 0x9fd8ff,
      size: 0.016,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
      ...(texture ? { map: texture, alphaTest: 0.01 } : {}),
    }),
  );
}

/**
 * Everything around the figure, as one group to add to the scene.
 *
 * `bodyHeight` is the figure's stature in metres, so the apparatus scales with
 * whatever body is standing in it rather than being measured for one asset.
 */
export function createTwinStageDecor(bodyHeight: number): TwinStageDecor {
  const group = new Group();
  group.name = "twin-stage-decor";
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const spark = glowTexture(0.35, 1);
  const halo = glowTexture(0.22, 0.85);
  for (const texture of [spark, halo]) if (texture) keep(texture);

  // The platform: a bright rim, a dimmer one outside it, and a flat pool of
  // light on the floor inside both.
  for (const ring of [
    platformRing(PLATFORM_INNER, PLATFORM_INNER + 0.012, STAGE_COLOUR, 0.95),
    platformRing(PLATFORM_OUTER, PLATFORM_OUTER + 0.008, STAGE_COLOUR, 0.5),
    platformRing(PLATFORM_OUTER + 0.1, PLATFORM_OUTER + 0.005 + 0.1, STAGE_DEEP, 0.3),
  ]) {
    ring.position.y = 0.004;
    keep(ring.geometry);
    keep(ring.material as MeshBasicMaterial);
    group.add(ring);
  }
  if (halo) {
    const pool = new Mesh(
      new RingGeometry(0, PLATFORM_OUTER + 0.22, 64),
      new MeshBasicMaterial({
        map: halo,
        color: STAGE_DEEP,
        transparent: true,
        opacity: 0.34,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.002;
    keep(pool.geometry);
    keep(pool.material as MeshBasicMaterial);
    group.add(pool);
  }

  // The dashed rings behind the figure, standing upright and centred on the
  // chest, which is where the screen they come from puts them.
  for (const [radius, steps, gapFraction, opacity] of [
    [0.52, 64, 0.55, 0.4],
    [0.66, 84, 0.6, 0.26],
    [0.82, 104, 0.65, 0.16],
  ] as const) {
    const circle = dashedCircle(
      radius * (bodyHeight / 1.7),
      steps,
      gapFraction,
      STAGE_COLOUR,
      opacity,
    );
    circle.position.set(0, bodyHeight * 0.62, -0.32);
    keep(circle.geometry);
    keep(circle.material as LineBasicMaterial);
    group.add(circle);
  }

  const grid = floorGrid(5, 24, 2.6);
  keep(grid.geometry);
  keep(grid.material as LineBasicMaterial);
  group.add(grid);

  const dust = particles(160, spark);
  keep(dust.geometry);
  keep(dust.material as PointsMaterial);
  group.add(dust);

  return {
    group,
    dispose() {
      for (const item of disposables) item.dispose();
      group.clear();
    },
  };
}
