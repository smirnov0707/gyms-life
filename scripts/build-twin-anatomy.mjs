/**
 * Builds the Twin's anatomical figure from BodyParts3D.
 *
 * The old figure was a smooth base mesh with regions cut out of one continuous
 * surface. However carefully that surface was cut, a region stayed a patch of
 * skin with a boundary drawn on it: no pectoral, no deltoid, nothing the eye
 * reads as a muscle. This builds the figure out of the muscles themselves.
 *
 * BodyParts3D ships each anatomical structure as its own OBJ, named in
 * Terminologia Anatomica, and ships the whole-body skin surface in the very
 * same coordinate frame — so the silhouette and the muscles inside it line up
 * exactly, which two models from two sources never would.
 *
 * Build-time only; the browser fetches the finished GLB.
 *
 *   node scripts/build-twin-anatomy.mjs <extracted-obj-dir> <isa_element_parts.txt>
 *
 * The source archive is not in this repository. It is downloaded from
 *   https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
 * and the attribution its licence requires is written into the manifest by
 * this script, so the credit cannot drift away from the file it describes.
 */
import { Document, NodeIO, PropertyType } from "@gltf-transform/core";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { MUSCLE_REGIONS, SKIN_NAME, regionForMuscle } from "./twin-muscle-regions.mjs";

const OUT = "public/models/twin-anatomy-v1.glb";
const MANIFEST = "public/models/twin-anatomy.manifest.json";

/** The credit this data's licence requires, verbatim from the source files. */
const ATTRIBUTION =
  "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan";

const SOURCE = {
  title: "BodyParts3D",
  creator: "Kousaku Okubo, Database Center for Life Science (DBCLS)",
  url: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html",
  release: "BP3D 4.0",
  licence: "CC BY-SA 2.1 JP",
  licenceUrl: "http://creativecommons.org/licenses/by-sa/2.1/jp/",
  attribution: ATTRIBUTION,
  requirements: "Attribution required, and derivative works must be shared under the same licence.",
};

/**
 * How many triangles each part of the figure is allowed.
 *
 * The atlas is drawn for study, not for a phone: the skin alone is 203k
 * triangles and the muscles another 300k, which is two orders of magnitude
 * past what belongs in a page the athlete opens every morning. Muscles keep a
 * larger share than the skin because their shape is the whole point — the
 * silhouette only has to read as a body.
 */
const SKIN_TRIANGLES = 26_000;
// Shared out in proportion to the surface each region covers in the source,
// which is why this is lower than it looks: the forearm alone is 24 finely
// modelled muscles and takes a large share of whatever it is given.
const MUSCLE_TRIANGLES = 62_000;

/** Metres of stature to scale the atlas to, so the figure matches the app's. */
const TARGET_HEIGHT_M = 1.7;

/** Parses the subset of OBJ these files use: vertices and triangular faces. */
function readObj(path) {
  const positions = [];
  const indices = [];
  for (const line of readFileSync(path, "latin1").split("\n")) {
    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      positions.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (line.startsWith("f ")) {
      // Faces index from 1 and may carry texture/normal references.
      const corners = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((corner) => Number(corner.split("/")[0]) - 1);
      // Triangulated as a fan, which is right for the convex faces here.
      for (let i = 2; i < corners.length; i += 1) {
        indices.push(corners[0], corners[i - 1], corners[i]);
      }
    }
  }
  return { positions, indices };
}

/** Area-weighted vertex normals, recomputed because simplification moves them. */
function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const base of [a, b, c]) {
      normals[base] += nx;
      normals[base + 1] += ny;
      normals[base + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }
  return normals;
}

const [objDir, elementsFile] = process.argv.slice(2);
if (!objDir || !elementsFile) {
  console.error("usage: node scripts/build-twin-anatomy.mjs <obj-dir> <isa_element_parts.txt>");
  process.exit(1);
}

// Which file holds which structure. One name can span several meshes, and one
// mesh can carry several names; both are kept, and a mesh is only ever used by
// the first region that claims it.
const claimed = new Map();
const skinFiles = new Set();
const available = new Set(
  readdirSync(objDir)
    .filter((file) => file.endsWith(".obj"))
    .map((file) => file.slice(0, -4)),
);

for (const line of readFileSync(elementsFile, "utf8").split("\n").slice(1)) {
  const [, name, fileId] = line.replace(/\r$/, "").split("\t");
  if (!name || !fileId || !available.has(fileId)) continue;
  if (name.trim().toLowerCase() === SKIN_NAME) {
    skinFiles.add(fileId);
    continue;
  }
  const region = regionForMuscle(name);
  if (region && !claimed.has(fileId)) claimed.set(fileId, region);
}

/**
 * How close a muscle has to be, as a fraction of the figure's stature, for the
 * skin over it to be dropped.
 *
 * The figure is an ecorche: the muscles are the surface the athlete looks at,
 * and the skin is kept only where there is no muscle under it to show — the
 * head, the hands, the feet, the shins over the bare tibia, and the pelvis.
 * The first build instead drew the whole skin as 17%-opacity glass over
 * everything, which made every muscle a pale blue smudge and the hands and
 * face look like they were behind frosted plastic.
 *
 * About 2 cm on a 1.7 m body, which is roughly what skin and fat measure over
 * a muscle on this cadaver. Too small and the skin survives in patches over
 * the thinner muscles; too large and it retreats off the hands.
 */
const SKIN_CLEARANCE = 0.012;

/**
 * Where the skin is kept whatever lies under it, as fractions of stature and
 * of half the figure's width.
 *
 * The long tendons of the forearm and the shin run all the way on to the
 * fingers and toes, so proximity alone strips the skin off the hands and feet
 * and leaves a fan of coloured tendons where a hand should be. Skin wins there
 * instead: it is opaque and sits outside the tendons, so keeping it is enough
 * to cover them, and getting the bound slightly wrong only leaves a little
 * extra skin — where culling a muscle by height would lose the muscle.
 */
const FOOT_TOP = 0.065;
const HAND_TOP = 0.47;
const HAND_SPREAD = 0.55;

/**
 * The patch of kept skin at the pelvis that gets rounded off, as fractions of
 * stature and of half the figure's width.
 *
 * The atlas is a complete cadaveric body and the pelvis has no muscle over its
 * front, so that is one of the places the skin stays — genitals and all. The
 * previous build covered it with a pair of opaque black shorts, which read as
 * kit stuck on a medical model.
 *
 * It is rounded away instead, by smoothing: the patch's own edge is held
 * still and everything inside it is repeatedly moved to the average of its
 * neighbours, which is a surface that converges on the smooth one spanning
 * that edge. Pulling the surface back in depth was tried first and did
 * nothing — the genitals sit at the same depth as the thighs beside them, so
 * there was nothing for a depth limit to cut.
 */
const GROIN_LOW = 0.4;
const GROIN_HIGH = 0.53;
/** How far from the midline the rounding reaches, as a fraction of half-width. */
const GROIN_MIDLINE = 0.36;
/**
 * Smoothing runs to convergence rather than for a fixed look. It is a few
 * thousand vertices, so the cost is nothing and stopping early leaves a lobe.
 */
const GROIN_SMOOTHING_PASSES = 400;

/**
 * The zone the genitals occupy, as fractions of stature and of half-width.
 *
 * Smoothing alone cannot remove them. The surface there is a tube, and a
 * Laplacian pass with a pinned edge converges on the smooth surface spanning
 * that edge — which for a tube is the tube pulled down to a needle, and a
 * needle at the crotch is what the first attempt shipped. So the tube is
 * welded shut first, by moving every vertex in it to one point on the pubis,
 * and the smoothing then rounds what is left.
 *
 * Measured rather than guessed: across these heights the midline of the atlas
 * carries ten times the vertices it does above or below, and reaches 4 cm
 * further forward than the hips beside it.
 */
const GENITAL_LOW = 0.445;
const GENITAL_HIGH = 0.515;
const GENITAL_WIDTH = 0.12;

/** Every mesh that will be drawn, grouped by the region it belongs to. */
const groups = new Map([["neutral", [...skinFiles]]]);
for (const region of MUSCLE_REGIONS) groups.set(region, []);
for (const [fileId, region] of claimed) groups.get(region).push(fileId);

// The atlas is in millimetres with Z up and the front of the body at negative
// Y. glTF is Y up and faces +Z, so every point is remapped once, here.
const toGltf = (x, y, z) => [x, z, -y];

const merged = new Map();
let sourceTriangles = 0;
for (const [region, files] of groups) {
  if (files.length === 0) continue;
  const positions = [];
  const indices = [];
  for (const fileId of files) {
    const mesh = readObj(join(objDir, `${fileId}.obj`));
    const base = positions.length / 3;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      positions.push(...toGltf(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]));
    }
    for (const index of mesh.indices) indices.push(base + index);
  }
  sourceTriangles += indices.length / 3;
  merged.set(region, { positions, indices, files: files.length });
}

// One frame for the whole figure, measured on the silhouette so the muscles
// keep their true place inside it.
let minY = Infinity;
let maxY = -Infinity;
let sumX = 0;
let sumZ = 0;
let count = 0;
const silhouette = merged.get("neutral");
for (let i = 0; i < silhouette.positions.length; i += 3) {
  minY = Math.min(minY, silhouette.positions[i + 1]);
  maxY = Math.max(maxY, silhouette.positions[i + 1]);
  sumX += silhouette.positions[i];
  sumZ += silhouette.positions[i + 2];
  count += 1;
}
const scale = TARGET_HEIGHT_M / (maxY - minY);
const centreX = sumX / count;
const centreZ = sumZ / count;

// The skin is one mesh covering the whole body. Every triangle of it that has
// a muscle underneath is dropped here, before anything is scaled or
// simplified, so what survives is the head, the hands, the feet, the shins
// over the bare tibia and the pelvis — and the muscles are the surface
// everywhere else.
{
  const skin = merged.get("neutral");
  const height = maxY - minY;
  const reach = SKIN_CLEARANCE * height;

  // Every muscle vertex, bucketed into cubes one reach across, so a triangle
  // asks 27 buckets rather than all 700,000 of them. A linear scan here takes
  // longer than the rest of the build put together.
  const cell = reach;
  const grid = new Map();
  const key = (x, y, z) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const [region, group] of merged) {
    if (region === "neutral") continue;
    for (let i = 0; i < group.positions.length; i += 3) {
      const at = key(group.positions[i], group.positions[i + 1], group.positions[i + 2]);
      const bucket = grid.get(at);
      if (bucket) bucket.push(group.positions[i], group.positions[i + 1], group.positions[i + 2]);
      else grid.set(at, [group.positions[i], group.positions[i + 1], group.positions[i + 2]]);
    }
  }
  const covered = (x, y, z) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i += 3) {
            const ax = bucket[i] - x;
            const ay = bucket[i + 1] - y;
            const az = bucket[i + 2] - z;
            if (ax * ax + ay * ay + az * az <= reach * reach) return true;
          }
        }
      }
    }
    return false;
  };

  // Half the figure's width, measured on the skin, so the hand test is stated
  // in the body's own proportions rather than in millimetres of atlas.
  let halfWidth = 0;
  for (let i = 0; i < skin.positions.length; i += 3) {
    halfWidth = Math.max(halfWidth, Math.abs(skin.positions[i] - centreX));
  }
  /** True where the skin is kept whatever lies under it: the hands and feet. */
  const extremity = (x, y) => {
    const fraction = (y - minY) / height;
    if (fraction <= FOOT_TOP) return true;
    return fraction <= HAND_TOP && Math.abs(x - centreX) >= HAND_SPREAD * halfWidth;
  };

  const keep = [];
  for (let i = 0; i < skin.indices.length; i += 3) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k += 1) {
      const at = skin.indices[i + k] * 3;
      x += skin.positions[at] / 3;
      y += skin.positions[at + 1] / 3;
      z += skin.positions[at + 2] / 3;
    }
    if (extremity(x, y) || !covered(x, y, z)) {
      keep.push(skin.indices[i], skin.indices[i + 1], skin.indices[i + 2]);
    }
  }
  skin.indices = keep;

  // The pelvis is one of the places the skin survives, so it is rounded off
  // here: the genitals are welded shut, and then the patch across the groin is
  // smoothed until it converges, with its own edge pinned so the rounding
  // cannot pull the hips or the thighs in with it.
  {
    const kept = new Set(keep);
    const midline = (index) =>
      Math.abs(skin.positions[index * 3] - centreX) <= GENITAL_WIDTH * halfWidth;
    const at = (index) => (skin.positions[index * 3 + 1] - minY) / height;
    // One point on the pubis, taken from the ring of surface just above the
    // zone, so the weld lands on the body rather than in the air in front of it.
    let ax = 0;
    let ay = 0;
    let az = 0;
    let ring = 0;
    for (const index of kept) {
      if (!midline(index)) continue;
      const fraction = at(index);
      if (fraction < GENITAL_HIGH || fraction > GENITAL_HIGH + 0.012) continue;
      ax += skin.positions[index * 3];
      ay += skin.positions[index * 3 + 1];
      az += skin.positions[index * 3 + 2];
      ring += 1;
    }
    if (ring === 0) throw new Error("no pubic surface found to weld the genitals to");
    ax /= ring;
    ay /= ring;
    az /= ring;
    let welded = 0;
    for (const index of kept) {
      if (!midline(index)) continue;
      const fraction = at(index);
      if (fraction < GENITAL_LOW || fraction > GENITAL_HIGH) continue;
      skin.positions[index * 3] = ax;
      skin.positions[index * 3 + 1] = ay;
      skin.positions[index * 3 + 2] = az;
      welded += 1;
    }
    console.log(`  groin: ${welded} vertices welded shut`);
  }
  const inGroin = (index) => {
    const fraction = (skin.positions[index * 3 + 1] - minY) / height;
    if (fraction < GROIN_LOW || fraction > GROIN_HIGH) return false;
    return Math.abs(skin.positions[index * 3] - centreX) <= GROIN_MIDLINE * halfWidth;
  };
  const neighbours = new Map();
  for (let i = 0; i < keep.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const from = keep[i + k];
      if (!inGroin(from)) continue;
      const list = neighbours.get(from) ?? [];
      list.push(keep[i + ((k + 1) % 3)], keep[i + ((k + 2) % 3)]);
      neighbours.set(from, list);
    }
  }
  // Only vertices whose whole neighbourhood is inside the patch move; the rest
  // are its edge, and they stay where the body put them.
  const movable = [...neighbours].filter(([, around]) => around.every(inGroin));
  for (let pass = 0; pass < GROIN_SMOOTHING_PASSES; pass += 1) {
    const moved = [];
    for (const [index, around] of movable) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (const other of around) {
        x += skin.positions[other * 3];
        y += skin.positions[other * 3 + 1];
        z += skin.positions[other * 3 + 2];
      }
      moved.push([index, x / around.length, y / around.length, z / around.length]);
    }
    for (const [index, x, y, z] of moved) {
      skin.positions[index * 3] = x;
      skin.positions[index * 3 + 1] = y;
      skin.positions[index * 3 + 2] = z;
    }
  }
  console.log(`  groin: ${movable.length} vertices rounded`);
}

const document = new Document();
const buffer = document.createBuffer();
const scene = document.createScene("twin-anatomy");
const node = document.createNode("twin-anatomy");
scene.addChild(node);
const mesh = document.createMesh("twin-anatomy");
node.setMesh(mesh);

await MeshoptSimplifier.ready;
const report = {};

for (const [region, group] of merged) {
  const positions = new Float32Array(group.positions.length);
  for (let i = 0; i < group.positions.length; i += 3) {
    positions[i] = (group.positions[i] - centreX) * scale;
    positions[i + 1] = (group.positions[i + 1] - minY) * scale;
    positions[i + 2] = (group.positions[i + 2] - centreZ) * scale;
  }
  const indices = new Uint32Array(group.indices);

  const primitive = document
    .createPrimitive()
    .setAttribute(
      "POSITION",
      document.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer),
    )
    .setAttribute(
      "NORMAL",
      document
        .createAccessor()
        .setType("VEC3")
        .setArray(computeNormals(positions, indices))
        .setBuffer(buffer),
    )
    .setIndices(document.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
    .setMaterial(
      document
        .createMaterial(`twin-region:${region}`)
        .setRoughnessFactor(0.6)
        .setMetallicFactor(0.05),
    );
  mesh.addPrimitive(primitive);
  report[region] = { meshes: group.files, sourceTriangles: indices.length / 3 };
}

// Deduplication is deliberately kept away from materials. Every region's
// material differs from the others only by its name, which is exactly what
// dedup treats as identical — it merged all nine into one, so every primitive
// reported the same region and the region mapping the whole figure rests on
// was quietly gone.
const DEDUP_TYPES = [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE];

await document.transform(weld(), dedup({ propertyTypes: DEDUP_TYPES }));

// Reduced one primitive at a time, driving the simplifier directly. A
// whole-document pass spends the budget wherever the triangles happen to be,
// which is the skin — and the skin is the one part whose detail does not
// matter. Each muscle region keeps a share of the muscle budget proportional
// to the surface it actually covers.
const muscleSource = [...merged].reduce(
  (sum, [region, group]) => sum + (region === "neutral" ? 0 : group.indices.length / 3),
  0,
);

for (const primitive of mesh.listPrimitives()) {
  const region = primitive.getMaterial().getName().replace("twin-region:", "");
  const indices = primitive.getIndices();
  const positions = primitive.getAttribute("POSITION");
  const before = indices.getCount() / 3;
  const budget =
    region === "neutral"
      ? SKIN_TRIANGLES
      : Math.max(600, Math.round((before / muscleSource) * MUSCLE_TRIANGLES));
  report[region].triangles = before;
  if (budget >= before) continue;

  // LockBorder keeps the open edges of a muscle where they are, so a mesh
  // that ends at a tendon does not shrink away from its attachment.
  const reduced = MeshoptSimplifier.simplify(
    indices.getArray(),
    positions.getArray(),
    3,
    budget * 3,
    0.01,
    ["LockBorder"],
  )[0];
  // Simplification only rewrites indices; every original vertex stays in the
  // buffer whether anything still points at it or not. Left alone that is the
  // whole atlas by weight — the file came out at 20 MB for 140k triangles —
  // so the surviving vertices are gathered up and renumbered here.
  const remap = new Map();
  const kept = [];
  const compact = new Uint32Array(reduced.length);
  const source = positions.getArray();
  for (let i = 0; i < reduced.length; i += 1) {
    const old = reduced[i];
    let next = remap.get(old);
    if (next === undefined) {
      next = kept.length / 3;
      remap.set(old, next);
      kept.push(source[old * 3], source[old * 3 + 1], source[old * 3 + 2]);
    }
    compact[i] = next;
  }
  const compactPositions = new Float32Array(kept);

  indices.setArray(compact);
  primitive.setAttribute(
    "POSITION",
    document.createAccessor().setType("VEC3").setArray(compactPositions).setBuffer(buffer),
  );
  primitive.setAttribute(
    "NORMAL",
    document
      .createAccessor()
      .setType("VEC3")
      .setArray(computeNormals(compactPositions, compact))
      .setBuffer(buffer),
  );
  report[region].triangles = compact.length / 3;
}

// Prune last: replacing an attribute leaves the accessor it replaced behind,
// and those orphans were most of the file — 17 MB for 140k triangles.
await document.transform(
  dedup({ propertyTypes: DEDUP_TYPES }),
  prune(),
  // Positions and normals to fixed point. Three reads KHR_mesh_quantization
  // natively, so this costs the browser no decoder — unlike meshopt or Draco,
  // which would each add one to the page for the same kind of saving.
  quantize({ quantizePosition: 14, quantizeNormal: 10 }),
);

mkdirSync(dirname(OUT), { recursive: true });
await new NodeIO().write(OUT, document);

const bytes = statSync(OUT).size;
writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      note: "Generated by scripts/build-twin-anatomy.mjs. Do not edit by hand.",
      version: "v1",
      source: SOURCE,
      file: OUT.replace("public/", ""),
      bytes,
      gzipBytes: gzipSync(readFileSync(OUT)).length,
      targetHeightMetres: TARGET_HEIGHT_M,
      regions: report,
    },
    null,
    2,
  )}\n`,
);

const total = Object.values(report).reduce((sum, r) => sum + (r.triangles ?? 0), 0);
console.log(`source ${sourceTriangles.toLocaleString()} triangles -> ${total.toLocaleString()}`);
for (const [region, r] of Object.entries(report)) {
  console.log(
    `  ${region.padEnd(10)} ${String(r.meshes).padStart(3)} meshes  ${String(r.triangles).padStart(7)} tris`,
  );
}
console.log(`${OUT}  ${(bytes / 1e6).toFixed(1)} MB`);
