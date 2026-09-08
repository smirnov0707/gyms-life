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
 * The floor: a square grid running back to the horizon, fading with distance.
 *
 * It was a set of concentric rings, which reads as a target painted under the
 * figure rather than as a room it is standing in. A grid in perspective is
 * what gives the stage its depth, and it is the one the screen this is drawn
 * from uses.
 *
 * Drawn as segments rather than a texture so it has no resolution to run out
 * of when the athlete zooms in on a foot.
 */
function floorGrid(step: number, reach: number) {
  const points: number[] = [];
  const colours: number[] = [];
  const near = new Color(STAGE_COLOUR);
  const far = new Color(0x050c18);
  // Brightness by distance from the figure, so the grid dissolves outwards
  // instead of ending on a hard square edge.
  const shadeAt = (x: number, z: number) =>
    near.clone().lerp(far, Math.min(1, Math.hypot(x, z) / reach));
  const line = (x1: number, z1: number, x2: number, z2: number) => {
    const a = shadeAt(x1, z1);
    const b = shadeAt(x2, z2);
    points.push(x1, 0, z1, x2, 0, z2);
    colours.push(a.r, a.g, a.b, b.r, b.g, b.b);
  };
  for (let at = -reach; at <= reach + 1e-6; at += step) {
    // Each line is cut into segments so its colour can fade along its length
    // rather than only at its ends.
    for (let piece = -reach; piece < reach - 1e-6; piece += step) {
      line(at, piece, at, piece + step);
      line(piece, at, piece + step, at);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/**
 * The wash of light behind the figure: a wide plane carrying a radial glow,
 * standing upright well behind it and always facing the camera's home.
 *
 * The canvas is transparent and sits on whatever card the host gives it, so
 * this is how the stage gets its own deep blue rather than borrowing the
 * page's black.
 */
function backdrop(texture: CanvasTexture | null, size: number) {
  if (!texture) return null;
  const plane = new Mesh(
    new RingGeometry(0, size, 64),
    new MeshBasicMaterial({
      map: texture,
      color: 0x1a4e96,
      transparent: true,
      opacity: 0.32,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  plane.renderOrder = -10;
  return plane;
}

/**
 * The instrument's own axis: a thin line down the front of the figure with a
 * few nodes on it.
 *
 * It carries no reading and never changes — it is drawn in the apparatus's own
 * cyan, the colour of the platform and the grid, and never in one of the data
 * colours, so it cannot be mistaken for a state. It sits a little in front of
 * the chest rather than being drawn over everything, so turning the figure
 * round hides it exactly as it hides the chest.
 */
function centreLine(bodyHeight: number, texture: CanvasTexture | null) {
  const group = new Group();
  const forward = bodyHeight * 0.115;
  const from = bodyHeight * 0.47;
  const to = bodyHeight * 0.8;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, from, forward, 0, to, forward]), 3),
  );
  const line = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: STAGE_COLOUR,
      transparent: true,
      opacity: 0.32,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(line);
  if (texture) {
    const nodes = new BufferGeometry();
    nodes.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([0.82, 0.66, 0.53].flatMap((at) => [0, bodyHeight * at, forward + 0.004])),
        3,
      ),
    );
    group.add(
      new Points(
        nodes,
        new PointsMaterial({
          map: texture,
          color: STAGE_COLOUR,
          size: 0.085,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.85,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
  }
  return group;
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
    platformRing(PLATFORM_INNER, PLATFORM_INNER + 0.018, STAGE_COLOUR, 1),
    platformRing(PLATFORM_INNER - 0.03, PLATFORM_INNER, STAGE_COLOUR, 0.45),
    platformRing(PLATFORM_INNER + 0.018, PLATFORM_INNER + 0.055, STAGE_COLOUR, 0.35),
    platformRing(PLATFORM_OUTER + 0.12, PLATFORM_OUTER + 0.136, STAGE_COLOUR, 0.6),
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
        opacity: 0.6,
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
    [0.44, 56, 0.5, 0.75],
    [0.62, 76, 0.55, 0.45],
    [0.86, 100, 0.6, 0.22],
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

  const glow = backdrop(halo, bodyHeight * 2.1);
  if (glow) {
    glow.position.set(0, bodyHeight * 0.5, -1.2);
    keep(glow.geometry);
    keep(glow.material as MeshBasicMaterial);
    group.add(glow);
  }

  const grid = floorGrid(0.22, 3.2);
  keep(grid.geometry);
  keep(grid.material as LineBasicMaterial);
  group.add(grid);

  const axis = centreLine(bodyHeight, spark);
  for (const child of axis.children) {
    const drawn = child as LineSegments | Points;
    keep(drawn.geometry);
    keep(drawn.material as LineBasicMaterial | PointsMaterial);
  }
  group.add(axis);

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
