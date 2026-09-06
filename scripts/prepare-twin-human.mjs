/**
 * Builds the Digital Twin human asset from its licensed source model.
 *
 * The source is one glTF containing a male and a female figure standing side
 * by side. Shipping both would double a download the athlete only ever sees
 * half of, so each figure is extracted into its own file, centred on the
 * origin and stood on the ground plane.
 *
 * Build-time only. The browser never runs this; it fetches the finished GLB.
 *
 *   node scripts/prepare-twin-human.mjs <source.glb>
 *
 * Provenance and licence live in public/models/twin-human.manifest.json and
 * are written by this script from SOURCE below, so the credit CC-BY requires
 * cannot drift away from the file it describes.
 */
import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, weld } from "@gltf-transform/functions";
import {
  regionForBone,
  normaliseBone,
  REGIONS,
  REGION_MATERIAL_PREFIX,
} from "./twin-human-regions.mjs";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
// The renderer is the only authority on where a skinned figure ends up, so the
// build measures the finished bytes with the same loader the browser uses.
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Quaternion, Vector3 } from "three";

const SOURCE = {
  title: "Human Male/Female Basemesh Rigged",
  author: "Niclas",
  authorProfile: "https://sketchfab.com/niclas.schoepe",
  url: "https://sketchfab.com/3d-models/human-malefemale-basemesh-rigged-96fa14a5a3f0413e98b605e3f65e447c",
  licence: "CC BY 4.0",
  licenceUrl: "http://creativecommons.org/licenses/by/4.0/",
  requirements: "Author must be credited. Commercial use is allowed.",
};

/** Top-level node name in the source for each figure we publish. */
const FIGURES = {
  male: "Male_Basemesh_Rig_01_1730",
  female: "Female_Basemesh_Rig_868",
};

/** How far a garment stands off the skin, in metres. */
const GARMENT_OFFSET_M = 0.008;

/**
 * The kit each figure is dressed in, cut from its own surface.
 *
 * `bones` chooses the band of the body a garment is taken from, and `hem` and
 * `waist` are fractions of that band's height — measured on the figure rather
 * than assumed, so the same numbers fit a taller or shorter mesh.
 */
const GARMENTS = {
  shorts: { name: "twin-shorts", bones: /^DEF-(pelvis|thigh)$/, hem: 0.34, waist: 0.88 },
  top: {
    name: "twin-top",
    bones: /^DEF-(breast|spine\.00[23])$/,
    hem: 0.34,
    waist: 0.86,
  },
};

/** Female figures also get a training top. A bare chest is not sportswear. */
const KIT = { male: ["shorts"], female: ["shorts", "top"] };

/**
 * The source figures stand with their arms out at about 40 degrees below
 * horizontal — a modelling pose, made so a rigger can reach the armpit, not a
 * pose anyone stands in. Both arms are swung down by this much so the figure
 * reads as a person standing rather than one being measured.
 */
const ARM_DROP_DEG = 35;
/** Which way each upper arm swings around the world Z axis to come down. */
const ARM_BONES = [
  [/^DEF-upper_arm\.L(_\d+)?$/, -1],
  [/^DEF-upper_arm\.R(_\d+)?$/, 1],
];

const OUT_DIR = resolve("public/models");
const VERSION = "v1";

const io = new NodeIO();
const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("usage: node scripts/prepare-twin-human.mjs <source.glb>");
  process.exit(1);
}

const stats = {};

for (const [variant, nodeName] of Object.entries(FIGURES)) {
  const document = await io.read(sourcePath);
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // Find the figure anywhere in the graph, then lift it to be the only root.
  const wanted = root.listNodes().find((n) => n.getName() === nodeName);
  if (!wanted) throw new Error(`figure "${nodeName}" not found in ${sourcePath}`);

  const parent = wanted.getParentNode();
  if (parent) parent.removeChild(wanted);

  // Detaching the other figure's root is not enough. Its 700-odd joints stay
  // parented to one another, and prune() only peels one orphaned level per
  // pass, so the whole rival skeleton survives in the file — unreachable from
  // the scene but still parsed on every load. Dispose the subtree explicitly.
  for (const node of scene.listChildren()) {
    disposeSubtree(node);
    scene.removeChild(node);
  }
  scene.addChild(wanted);

  // prune() drops everything the surviving figure does not reference:
  // the other skin's 700-odd joints, its mesh, accessors and buffer views.
  //
  // keepAttributes is on because this model carries UVs but no textures yet.
  // The default prune reads "unused attribute" and deletes them, which throws
  // away the unwrap the whole asset was chosen for.
  await document.transform(dedup(), prune({ keepAttributes: true }), weld());

  lowerArms(document);

  // Where a skinned figure appears has nothing to do with the translation on
  // the node that carries it: glTF says a skinned mesh's own node transform is
  // not applied, and every joint here hangs off the skeleton root, so the
  // source's side-by-side offset lives in the bones. Zero the node transform
  // and place the figure through its skeleton once the rest pose has been
  // measured — see standOnOrigin below.
  wanted.setTranslation([0, 0, 0]);

  // Deliberately not quantized. quantize() writes int16 positions that only
  // decode correctly when KHR_mesh_quantization is declared, and this pipeline
  // could not register that extension — the first run produced a file whose
  // geometry a compliant loader would read at the wrong scale. The figure is
  // under a megabyte uncompressed, so the trade was never worth taking.
  // Split and check before writing. Doing it after produced a file that had
  // none of the region materials in it while every check still passed, because
  // the checks were reading the document in memory rather than the artifact.
  for (const piece of KIT[variant]) addGarment(document, GARMENTS[piece]);
  const coverage = splitBodyByRegion(document);
  verify(document, variant);
  verifyRegions(coverage, variant);
  const height = verifyPlacement(await standOnOrigin(document, io), variant);

  mkdirSync(OUT_DIR, { recursive: true });
  const out = resolve(OUT_DIR, `twin-human-${variant}-${VERSION}.glb`);
  const glb = await io.writeBinary(document);
  writeFileSync(out, glb);

  stats[variant] = {
    file: `models/twin-human-${variant}-${VERSION}.glb`,
    bytes: glb.byteLength,
    gzipBytes: gzipSync(Buffer.from(glb)).byteLength,
    triangles: countTriangles(document),
    heightMetres: Number(height.toFixed(3)),
    joints: document.getRoot().listSkins()[0]?.listJoints().length ?? 0,
    textures: document.getRoot().listTextures().length,
    regions: coverage,
  };
  console.log(
    `${variant.padEnd(7)} ${(glb.byteLength / 1048576).toFixed(2)} MB ` +
      `(gzip ${(stats[variant].gzipBytes / 1048576).toFixed(2)} MB)  ` +
      `${stats[variant].triangles} tris  ${stats[variant].heightMetres} m  ` +
      `${stats[variant].joints} joints  ${stats[variant].textures} textures`,
  );
}

writeFileSync(
  resolve(OUT_DIR, "twin-human.manifest.json"),
  JSON.stringify(
    {
      note: "Generated by scripts/prepare-twin-human.mjs. Do not edit by hand.",
      version: VERSION,
      source: SOURCE,
      variants: stats,
    },
    null,
    2,
  ) + "\n",
);
console.log("manifest written to public/models/twin-human.manifest.json");

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      total +=
        (indices ? indices.getCount() : (primitive.getAttribute("POSITION")?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(total);
}

/**
 * Fails the build rather than shipping a broken figure. Each check here stands
 * for a defect this script actually produced at some point.
 */
function verify(document, variant) {
  const root = document.getRoot();
  const fail = (message) => {
    throw new Error(`${variant}: ${message}`);
  };

  const skins = root.listSkins();
  if (skins.length !== 1) fail(`expected one skeleton, found ${skins.length}`);

  // Nodes the scene cannot reach are dead weight every loader still parses.
  const scene = root.listScenes()[0];
  const reachable = new Set();
  const visit = (node) => {
    if (reachable.has(node)) return;
    reachable.add(node);
    node.listChildren().forEach(visit);
  };
  scene.listChildren().forEach(visit);
  const orphans = root.listNodes().length - reachable.size;
  if (orphans > 0) fail(`${orphans} nodes are unreachable from the scene`);

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (!primitive.getAttribute("TEXCOORD_0")) {
        fail(`mesh "${mesh.getName()}" lost its UVs; texturing would be impossible`);
      }
      const position = primitive.getAttribute("POSITION");
      // Anything but float positions means quantization crept back in, and
      // this pipeline cannot declare the extension that decodes them.
      if (position && position.getComponentType() !== 5126) {
        fail(`mesh "${mesh.getName()}" has non-float positions (${position.getComponentType()})`);
      }
    }
  }

  const triangles = countTriangles(document);
  if (triangles > 40_000) fail(`${triangles} triangles exceeds the low-LOD budget`);
}

/**
 * Swings both upper arms down into a standing pose.
 *
 * This changes the skeleton, not the mesh: the bind pose and the inverse bind
 * matrices are untouched, so the arms deform exactly as the rig intends. The
 * swing is expressed in world space and converted into each bone's own frame —
 * `conj(P) · R · P · q` for a parent world rotation `P` — because the rig
 * arrives rotated out of Blender's Z-up and a rotation written in bone-local
 * axes would send the arms somewhere unrelated.
 */
function lowerArms(document) {
  const nodes = document.getRoot().listNodes();
  const parentOf = new Map();
  for (const node of nodes) {
    for (const child of node.listChildren()) parentOf.set(child, node);
  }

  const worldRotation = (node) => {
    const chain = [];
    for (let parent = parentOf.get(node); parent; parent = parentOf.get(parent)) {
      chain.unshift(parent);
    }
    const rotation = new Quaternion();
    for (const parent of chain) rotation.multiply(new Quaternion().fromArray(parent.getRotation()));
    return rotation;
  };

  let posed = 0;
  for (const node of nodes) {
    const match = ARM_BONES.find(([pattern]) => pattern.test(node.getName()));
    if (!match) continue;
    const parent = worldRotation(node);
    const swing = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      match[1] * ARM_DROP_DEG * (Math.PI / 180),
    );
    node.setRotation(
      parent
        .clone()
        .invert()
        .multiply(swing)
        .multiply(parent)
        .multiply(new Quaternion().fromArray(node.getRotation()))
        .toArray(),
    );
    posed++;
  }
  if (posed !== 2) throw new Error(`expected two upper arms to pose, found ${posed}`);
}

/**
 * Measures the figure as a renderer draws it and moves its skeleton so it
 * stands on the ground, centred on the origin the camera orbits.
 *
 * The offset goes above the skeleton root rather than on the figure's node,
 * because a skinned mesh takes its position from the joint matrices and
 * nothing else. The earlier version corrected the node translation and passed
 * a bounds check computed from the same node hierarchy — while three.js drew
 * the figure 0.64 m to the side, out of reach of every click.
 *
 * Returns the rest-pose bounds of the placed figure.
 */
async function standOnOrigin(document, io) {
  const skin = document.getRoot().listSkins()[0];
  const skeleton = skin?.getSkeleton();
  if (!skeleton) throw new Error("no skeleton root; the figure cannot be placed");

  // Moving the skeleton root only moves the whole figure if every joint hangs
  // below it. A joint parented elsewhere would be left behind, tearing the
  // mesh apart in a way no bounding box would reveal.
  const below = new Set();
  const visit = (node) => {
    if (below.has(node)) return;
    below.add(node);
    node.listChildren().forEach(visit);
  };
  visit(skeleton);
  const stray = skin.listJoints().filter((joint) => !below.has(joint));
  if (stray.length) throw new Error(`${stray.length} joints sit outside the skeleton root`);

  const before = await restPoseBounds(await io.writeBinary(document));
  const origin = document
    .createNode("twin-origin")
    .setTranslation([
      -(before.min[0] + before.max[0]) / 2,
      -before.min[1],
      -(before.min[2] + before.max[2]) / 2,
    ]);
  const parent = skeleton.getParentNode() ?? document.getRoot().listScenes()[0];
  parent.removeChild(skeleton);
  parent.addChild(origin);
  origin.addChild(skeleton);

  return await restPoseBounds(await io.writeBinary(document));
}

/**
 * The bounding box of the figure with every vertex pushed through its joint
 * matrices in the rest pose — what the athlete actually sees. It needs a real
 * glTF loader, so it runs on the bytes about to be written rather than on the
 * document in memory, which is how the last placement bug hid.
 */
async function restPoseBounds(glb) {
  const bytes = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
  const gltf = await new Promise((done, failed) => {
    new GLTFLoader().parse(bytes, "", done, failed);
  });
  gltf.scene.updateMatrixWorld(true);

  const box = new Box3();
  const point = new Vector3();
  gltf.scene.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    const position = object.geometry.getAttribute("position");
    for (let v = 0; v < position.count; v++) {
      point.fromBufferAttribute(position, v);
      object.applyBoneTransform(v, point);
      box.expandByPoint(object.localToWorld(point));
    }
  });
  if (box.isEmpty()) throw new Error("no skinned geometry to measure");
  return { min: box.min.toArray(), max: box.max.toArray(), armDrop: armDropDegrees(gltf.scene) };
}

/**
 * How far the left arm hangs below horizontal, measured shoulder to hand on
 * the posed skeleton. Reading the pose back from the file is the only way to
 * know the swing above did what it meant to: a rotation applied in the wrong
 * frame still writes a valid quaternion.
 *
 * three sanitises bone names on load, so the dots the rig uses are gone.
 */
function armDropDegrees(scene) {
  const bone = (pattern) => {
    let found = null;
    scene.traverse((object) => {
      if (!found && object.isBone && pattern.test(object.name)) found = object;
    });
    return found;
  };
  const shoulder = bone(/^DEF-upper_armL/);
  const hand = bone(/^DEF-handL/);
  if (!shoulder || !hand) throw new Error("no left arm chain to measure");
  const from = shoulder.getWorldPosition(new Vector3());
  const to = hand.getWorldPosition(new Vector3());
  const reach = Math.hypot(to.x - from.x, to.z - from.z);
  return (Math.atan2(from.y - to.y, reach) * 180) / Math.PI;
}

/** Height, footing, centring and pose, checked against the rendered rest pose. */
function verifyPlacement({ min, max, armDrop }, variant) {
  const fail = (message) => {
    throw new Error(`${variant}: ${message}`);
  };
  const height = max[1] - min[1];
  if (height < 1.4 || height > 2.1) fail(`implausible height ${height.toFixed(2)} m`);
  if (Math.abs(min[1]) > 0.005)
    fail(`figure not standing on the ground (min y ${min[1].toFixed(3)})`);
  for (const [axis, i] of [
    ["x", 0],
    ["z", 2],
  ]) {
    const centre = (min[i] + max[i]) / 2;
    if (Math.abs(centre) > 0.005) fail(`figure not centred (${axis} ${centre.toFixed(3)})`);
  }
  // Below 60 degrees the figure is still being measured rather than standing;
  // past 85 the arms are flat against the body and its sides cannot be clicked.
  if (armDrop < 60 || armDrop > 85) {
    fail(`arms hang ${armDrop.toFixed(1)}° below horizontal, outside a standing pose`);
  }
  return height;
}

/**
 * Every canonical region must own enough surface to be worth offering. A region
 * that ends up with a handful of triangles is one the athlete cannot hit, and
 * an empty one is a body part the app claims to know about and cannot show.
 */
function verifyRegions(coverage, variant) {
  const missing = REGIONS.filter((region) => !coverage[region]);
  if (missing.length) {
    throw new Error(`${variant}: regions with no surface: ${missing.join(", ")}`);
  }
  const tiny = REGIONS.filter((region) => coverage[region] < 50);
  if (tiny.length) {
    throw new Error(
      `${variant}: regions too small to select: ` +
        tiny.map((r) => `${r}=${coverage[r]}`).join(", "),
    );
  }
  // A triangle assigned nowhere is a hole; one assigned twice is a double hit.
  const assigned = Object.values(coverage).reduce((a, b) => a + b, 0);
  return assigned;
}

/** Depth-first dispose, so a detached skeleton cannot survive in the file. */
function disposeSubtree(node) {
  for (const child of node.listChildren()) disposeSubtree(child);
  node.dispose();
}

/**
 * Rebuilds the body mesh as one primitive per canonical region.
 *
 * The runtime needs `regionMeshes` and `regionOf` to tint a region and to
 * resolve a click, and it gets both from separate meshes. Splitting here
 * rather than in the browser keeps the cost at build time and makes the result
 * reviewable: the counts land in the manifest and the test checks them.
 *
 * Returns triangle counts per region.
 */
function splitBodyByRegion(document) {
  const root = document.getRoot();
  const meshes = root.listMeshes();
  // The body is the mesh with the most triangles; the eyes are their own.
  const body = meshes.reduce((a, b) => (triangleCount(a) > triangleCount(b) ? a : b));
  const primitive = body.listPrimitives()[0];
  if (!primitive) throw new Error("body mesh has no primitive");

  const position = primitive.getAttribute("POSITION");
  const joints = primitive.getAttribute("JOINTS_0");
  const weights = primitive.getAttribute("WEIGHTS_0");
  const indices = primitive.getIndices();
  if (!position || !joints || !weights || !indices) {
    throw new Error("body mesh lacks the skinning data region mapping depends on");
  }

  const skin = root.listSkins()[0];
  const boneNames = skin.listJoints().map((joint) => joint.getName());

  const dominantBone = (vertex) => {
    const j = joints.getElement(vertex, [0, 0, 0, 0]);
    const w = weights.getElement(vertex, [0, 0, 0, 0]);
    let best = 0;
    for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
    return boneNames[j[best]] ?? "";
  };

  // Which way the figure faces is read from the model rather than assumed: the
  // nose sits on the front, so the sign of its mean z defines +front here.
  let noseZ = 0;
  let noseCount = 0;
  for (let v = 0; v < position.getCount(); v++) {
    if (!normaliseBone(dominantBone(v)).startsWith("DEF-nose")) continue;
    noseZ += position.getElement(v, [0, 0, 0])[2];
    noseCount++;
  }
  if (noseCount === 0) throw new Error("no nose bone found; cannot tell front from back");
  const frontSign = Math.sign(noseZ / noseCount) || 1;

  const groups = new Map();
  const triangles = indices.getCount() / 3;
  for (let t = 0; t < triangles; t++) {
    const a = indices.getScalar(t * 3);
    const b = indices.getScalar(t * 3 + 1);
    const c = indices.getScalar(t * 3 + 2);
    // One vote per triangle, taken at its centroid, so a face cannot be split
    // between two regions and leave a hole in both.
    const z =
      (position.getElement(a, [0, 0, 0])[2] +
        position.getElement(b, [0, 0, 0])[2] +
        position.getElement(c, [0, 0, 0])[2]) /
      3;
    const region = regionForBone(dominantBone(a), z * frontSign > 0);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(a, b, c);
  }

  const source = primitive.getMaterial();
  body.removePrimitive(primitive);
  const coverage = {};
  for (const [region, list] of [...groups.entries()].sort()) {
    // The region has to survive into the exported file, and a glTF primitive
    // has no name field — only meshes and materials do. A material per region
    // is how the loader recognises it, and the runtime needs one per region
    // anyway to tint them independently.
    const material = source.clone().setName(`${REGION_MATERIAL_PREFIX}${region}`);
    const next = document.createPrimitive().setMaterial(material);
    // Attributes are shared, not copied: one set of vertices, many index sets,
    // so the split costs indices only and the surface stays continuous.
    for (const name of primitive.listSemantics()) {
      next.setAttribute(name, primitive.getAttribute(name));
    }
    next.setIndices(
      document
        .createAccessor(`${region}-indices`)
        .setType("SCALAR")
        .setArray(list.length > 65535 ? new Uint32Array(list) : new Uint16Array(list)),
    );
    body.addPrimitive(next);
    coverage[region] = list.length / 3;
  }
  primitive.dispose();
  return coverage;
}

function triangleCount(mesh) {
  let total = 0;
  for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    total +=
      (indices ? indices.getCount() : (primitive.getAttribute("POSITION")?.getCount() ?? 0)) / 3;
  }
  return total;
}

/**
 * Neutral training shorts, built from the figure's own surface.
 *
 * The base mesh is nude. Rather than fit a separate garment — which needs an
 * artist and interpenetrates the moment the body moves — the shorts are the
 * body's own triangles over the hips and upper thighs, pushed out along their
 * normals by a few millimetres. They cannot clip through the leg because they
 * are the leg, and they follow the skeleton for free.
 *
 * Only the lower body is covered. The torso stays bare on purpose: chest,
 * back, abs and core are regions the athlete selects and reads data from, and
 * a shirt would hide exactly the surface this screen exists to show.
 */
function addGarment(document, spec) {
  const root = document.getRoot();
  const body = root.listMeshes().reduce((a, b) => (triangleCount(a) > triangleCount(b) ? a : b));
  const primitive = body.listPrimitives()[0];
  const position = primitive.getAttribute("POSITION");
  const normal = primitive.getAttribute("NORMAL");
  const joints = primitive.getAttribute("JOINTS_0");
  const weights = primitive.getAttribute("WEIGHTS_0");
  const uv = primitive.getAttribute("TEXCOORD_0");
  const indices = primitive.getIndices();
  if (!position || !normal || !joints || !weights || !uv || !indices) return;

  const skin = root.listSkins()[0];
  const boneNames = skin.listJoints().map((joint) => joint.getName());
  const dominant = (vertex) => {
    const j = joints.getElement(vertex, [0, 0, 0, 0]);
    const w = weights.getElement(vertex, [0, 0, 0, 0]);
    let best = 0;
    for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
    return normaliseBone(boneNames[j[best]] ?? "");
  };

  // Waistband and hem are taken from where the covered bones actually reach,
  // so the garment sits on this figure rather than on assumed proportions.
  let low = Infinity;
  let high = -Infinity;
  for (let v = 0; v < position.getCount(); v++) {
    if (!spec.bones.test(dominant(v))) continue;
    const y = position.getElement(v, [0, 0, 0])[1];
    low = Math.min(low, y);
    high = Math.max(high, y);
  }
  if (!Number.isFinite(low)) return;
  const hem = low + (high - low) * spec.hem;
  const waist = low + (high - low) * spec.waist;

  // Vertex records the clipper can interpolate. Joints and weights are taken
  // from the nearer end of a cut edge rather than blended: a skinning weight
  // is an index into a skeleton, and averaging two of them is meaningless.
  const vertexAt = (v) => ({
    p: position.getElement(v, [0, 0, 0]),
    n: normal.getElement(v, [0, 0, 0]),
    t: uv.getElement(v, [0, 0]),
    j: joints.getElement(v, [0, 0, 0, 0]),
    w: weights.getElement(v, [0, 0, 0, 0]),
  });
  const lerp = (a, b, s) => ({
    p: a.p.map((value, i) => value + (b.p[i] - value) * s),
    n: a.n.map((value, i) => value + (b.n[i] - value) * s),
    t: a.t.map((value, i) => value + (b.t[i] - value) * s),
    j: s < 0.5 ? a.j : b.j,
    w: s < 0.5 ? a.w : b.w,
  });

  /** Sutherland-Hodgman against a horizontal half-space, so hems come out straight. */
  const clip = (polygon, limit, keepAbove) => {
    const inside = (vertex) => (keepAbove ? vertex.p[1] >= limit : vertex.p[1] <= limit);
    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const previous = polygon[(i + polygon.length - 1) % polygon.length];
      const currentIn = inside(current);
      const previousIn = inside(previous);
      if (currentIn !== previousIn) {
        const span = current.p[1] - previous.p[1];
        out.push(lerp(previous, current, span === 0 ? 0 : (limit - previous.p[1]) / span));
      }
      if (currentIn) out.push(current);
    }
    return out;
  };

  const pos = [];
  const nrm = [];
  const jnt = [];
  const wgt = [];
  const tex = [];
  const idx = [];
  let pieces = 0;
  const triangles = indices.getCount() / 3;
  for (let t = 0; t < triangles; t++) {
    const tri = [
      indices.getScalar(t * 3),
      indices.getScalar(t * 3 + 1),
      indices.getScalar(t * 3 + 2),
    ];
    if (!tri.some((v) => spec.bones.test(dominant(v)))) continue;
    let polygon = tri.map(vertexAt);
    polygon = clip(polygon, hem, true);
    if (polygon.length < 3) continue;
    polygon = clip(polygon, waist, false);
    if (polygon.length < 3) continue;
    pieces++;
    // Fan-triangulate the clipped polygon, offsetting each vertex outward.
    const base = pos.length / 3;
    for (const vertex of polygon) {
      pos.push(
        vertex.p[0] + vertex.n[0] * GARMENT_OFFSET_M,
        vertex.p[1] + vertex.n[1] * GARMENT_OFFSET_M,
        vertex.p[2] + vertex.n[2] * GARMENT_OFFSET_M,
      );
      nrm.push(vertex.n[0], vertex.n[1], vertex.n[2]);
      tex.push(vertex.t[0], vertex.t[1]);
      jnt.push(vertex.j[0], vertex.j[1], vertex.j[2], vertex.j[3]);
      wgt.push(vertex.w[0], vertex.w[1], vertex.w[2], vertex.w[3]);
    }
    for (let k = 1; k + 1 < polygon.length; k++) idx.push(base, base + k, base + k + 1);
  }
  if (!pieces) return;

  const fabric = document
    .createMaterial(spec.name)
    .setBaseColorFactor([0.13, 0.15, 0.18, 1])
    .setRoughnessFactor(0.92)
    .setMetallicFactor(0);
  const piece = document
    .createPrimitive()
    .setMaterial(fabric)
    .setAttribute(
      "POSITION",
      document.createAccessor(`${spec.name}-pos`).setType("VEC3").setArray(new Float32Array(pos)),
    )
    .setAttribute(
      "NORMAL",
      document.createAccessor(`${spec.name}-nrm`).setType("VEC3").setArray(new Float32Array(nrm)),
    )
    .setAttribute(
      "JOINTS_0",
      document.createAccessor(`${spec.name}-jnt`).setType("VEC4").setArray(new Uint16Array(jnt)),
    )
    .setAttribute(
      "WEIGHTS_0",
      document.createAccessor(`${spec.name}-wgt`).setType("VEC4").setArray(new Float32Array(wgt)),
    )
    .setAttribute(
      "TEXCOORD_0",
      document.createAccessor(`${spec.name}-uv`).setType("VEC2").setArray(new Float32Array(tex)),
    )
    .setIndices(
      document.createAccessor(`${spec.name}-idx`).setType("SCALAR").setArray(new Uint32Array(idx)),
    );

  const garment = document.createMesh(spec.name);
  garment.addPrimitive(piece);
  // Same node as the body so it inherits the skeleton and moves with it.
  const bodyNode = root.listNodes().find((node) => node.getMesh() === body);
  const node = document
    .createNode(spec.name)
    .setMesh(garment)
    .setSkin(bodyNode?.getSkin() ?? null);
  bodyNode?.getParentNode()?.addChild(node) ?? document.getRoot().listScenes()[0].addChild(node);
  return pieces;
}
