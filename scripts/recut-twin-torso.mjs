/**
 * Re-cuts the front torso of the shipped Twin figures along the muscles.
 *
 * `prepare-twin-human.mjs` builds the figures from the licensed source model
 * and assigns every vertex to a region by its dominant deform bone. That is
 * right for limbs and wrong for the torso, where the spine is a straight chain
 * of segments and the muscles are not: the chest came out as a full-width band
 * of ribcage running from the upper abdomen to the collarbone, and lit up it
 * read as a tube top.
 *
 * This runs after that build, on the published GLBs, and moves triangles
 * between the three front-torso regions only. Nothing else is touched: the
 * back, the limbs, the garments and the head keep the assignment the rig gave
 * them, and no geometry is added, removed or moved. The region primitives all
 * index one shared vertex pool, so the whole cut is a repartition of index
 * buffers.
 *
 *   node scripts/recut-twin-torso.mjs [--force]
 *
 * Runs once per build of the source figures, and refuses a second run unless
 * forced. It measures the torso frame from the very triangles it reassigns,
 * and the breastbone strip it moves out of that set would shift the frame on a
 * second pass — so this is deliberately not idempotent, and says so rather
 * than quietly cutting a different body the next time it is run.
 */
import { NodeIO } from "@gltf-transform/core";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { FRONT_TORSO_REGIONS, frontTorsoMuscle } from "./twin-human-anatomy.mjs";
import { REGION_MATERIAL_PREFIX } from "./twin-human-regions.mjs";

const MANIFEST = "public/models/twin-human.manifest.json";
const VARIANTS = ["male", "female"];

const regionOfPrimitive = (primitive) => {
  const name = primitive.getMaterial()?.getName() ?? "";
  return name.startsWith(REGION_MATERIAL_PREFIX) ? name.slice(REGION_MATERIAL_PREFIX.length) : null;
};

async function recut(variant) {
  const file = `public/models/twin-human-${variant}-v1.glb`;
  const io = new NodeIO();
  const document = await io.read(file);

  /** Every region primitive, by region name. */
  const primitives = new Map();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const region = regionOfPrimitive(primitive);
      if (region) primitives.set(region, primitive);
    }
  }

  const torso = FRONT_TORSO_REGIONS.map((region) => primitives.get(region)).filter(Boolean);
  if (torso.length !== FRONT_TORSO_REGIONS.length) {
    throw new Error(`${variant}: the front torso regions are not all present`);
  }

  // One shared vertex pool across every region primitive, so positions can be
  // read from any of them.
  const position = torso[0].getAttribute("POSITION");

  /** The triangles up for reassignment, as vertex-index triples. */
  const triangles = [];
  for (const primitive of torso) {
    const indices = primitive.getIndices();
    for (let i = 0; i < indices.getCount(); i += 3) {
      triangles.push([indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)]);
    }
  }

  // The torso frame, measured off the very triangles being cut rather than
  // assumed in metres, so one rule fits figures of different heights.
  const vertex = [0, 0, 0];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const triangle of triangles) {
    for (const index of triangle) {
      position.getElement(index, vertex);
      if (vertex[0] < minX) minX = vertex[0];
      if (vertex[0] > maxX) maxX = vertex[0];
      if (vertex[1] < minY) minY = vertex[1];
      if (vertex[1] > maxY) maxY = vertex[1];
    }
  }
  const midX = (minX + maxX) / 2;
  const halfWidth = (maxX - minX) / 2;
  const height = maxY - minY;
  if (!(halfWidth > 0) || !(height > 0)) throw new Error(`${variant}: the torso has no extent`);

  /** Triangles per region after the cut, plus the ones that fall out of all. */
  const cut = new Map(FRONT_TORSO_REGIONS.map((region) => [region, []]));
  const neutralised = [];

  for (const triangle of triangles) {
    // The centroid decides, so a triangle lands whole in one region rather
    // than being split — the mesh is never re-tessellated here.
    let cx = 0;
    let cy = 0;
    for (const index of triangle) {
      position.getElement(index, vertex);
      cx += vertex[0] / 3;
      cy += vertex[1] / 3;
    }
    const region = frontTorsoMuscle((cx - midX) / halfWidth, (cy - minY) / height);
    if (region === null) neutralised.push(triangle);
    else cut.get(region).push(triangle);
  }

  // Surface the app holds no reading for — the breastbone, the flanks — joins
  // the neutral primitive rather than being dropped, so the figure keeps every
  // triangle it had and no hole opens in the mesh.
  const neutral = primitives.get("neutral");
  if (!neutral) throw new Error(`${variant}: no neutral region to hold unassigned surface`);

  const write = (primitive, list, append = false) => {
    const indices = primitive.getIndices();
    const existing = [];
    if (append) {
      for (let i = 0; i < indices.getCount(); i += 3) {
        existing.push([indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)]);
      }
    }
    const all = [...existing, ...list];
    const flat = new Uint32Array(all.length * 3);
    all.forEach((triangle, t) => {
      flat[t * 3] = triangle[0];
      flat[t * 3 + 1] = triangle[1];
      flat[t * 3 + 2] = triangle[2];
    });
    indices.setArray(flat);
    return all.length;
  };

  const counts = {};
  for (const region of FRONT_TORSO_REGIONS) {
    counts[region] = write(primitives.get(region), cut.get(region));
  }
  const neutralTotal = write(neutral, neutralised, true);

  await io.write(file, document);

  const before = triangles.length;
  const after = FRONT_TORSO_REGIONS.reduce((sum, r) => sum + counts[r], 0) + neutralised.length;
  if (before !== after) throw new Error(`${variant}: ${before} triangles in, ${after} out`);

  return { counts, neutral: neutralTotal, moved: neutralised.length, file };
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const CUT_VERSION = "v1";
if (manifest.frontTorsoCut === CUT_VERSION && !process.argv.includes("--force")) {
  console.error(
    `The front torso is already cut (${CUT_VERSION}). Rebuild the figures from source first,` +
      " or pass --force if you know the GLBs are freshly built.",
  );
  process.exit(1);
}

for (const variant of VARIANTS) {
  const { counts, neutral, moved, file } = await recut(variant);
  const entry = manifest.variants[variant];
  for (const region of FRONT_TORSO_REGIONS) entry.regions[region] = counts[region];
  entry.regions.neutral = neutral;
  entry.bytes = statSync(file).size;
  entry.gzipBytes = gzipSync(readFileSync(file)).length;
  console.log(
    `${variant}: chest ${counts.chest}, abs ${counts.abs}, core ${counts.core}` +
      `, ${moved} triangles to neutral`,
  );
}
manifest.frontTorsoCut = CUT_VERSION;
manifest.note =
  "Generated by scripts/prepare-twin-human.mjs, front torso re-cut by scripts/recut-twin-torso.mjs. Do not edit by hand.";
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
