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
import { NodeIO, getBounds } from "@gltf-transform/core";
import { dedup, prune, weld } from "@gltf-transform/functions";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";

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

  // Stand the figure on the ground and centre it left-to-right, so the scene
  // does not have to know where in the source it happened to be posed.
  //
  // getBounds walks the node hierarchy. Reading accessor min/max instead
  // measures the mesh in its own local space while the correction is applied
  // to the node's translation — two different spaces, and the figure ends up
  // hovering. The verification below caught exactly that.
  const bounds = getBounds(scene);
  const translation = wanted.getTranslation();
  wanted.setTranslation([
    translation[0] - (bounds.min[0] + bounds.max[0]) / 2,
    translation[1] - bounds.min[1],
    translation[2] - (bounds.min[2] + bounds.max[2]) / 2,
  ]);

  // Deliberately not quantized. quantize() writes int16 positions that only
  // decode correctly when KHR_mesh_quantization is declared, and this pipeline
  // could not register that extension — the first run produced a file whose
  // geometry a compliant loader would read at the wrong scale. The figure is
  // under a megabyte uncompressed, so the trade was never worth taking.
  mkdirSync(OUT_DIR, { recursive: true });
  const out = resolve(OUT_DIR, `twin-human-${variant}-${VERSION}.glb`);
  const glb = await io.writeBinary(document);
  writeFileSync(out, glb);

  verify(document, variant);

  stats[variant] = {
    file: `models/twin-human-${variant}-${VERSION}.glb`,
    bytes: glb.byteLength,
    gzipBytes: gzipSync(Buffer.from(glb)).byteLength,
    triangles: countTriangles(document),
    heightMetres: Number((getBounds(scene).max[1] - getBounds(scene).min[1]).toFixed(3)),
    joints: document.getRoot().listSkins()[0]?.listJoints().length ?? 0,
    textures: document.getRoot().listTextures().length,
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

  const { min, max } = getBounds(document.getRoot().listScenes()[0]);
  const height = max[1] - min[1];
  if (height < 1.4 || height > 2.1) fail(`implausible height ${height.toFixed(2)} m`);
  if (Math.abs(min[1]) > 0.01)
    fail(`figure not standing on the ground (min y ${min[1].toFixed(3)})`);
  const centreX = (min[0] + max[0]) / 2;
  if (Math.abs(centreX) > 0.05) fail(`figure not centred (x ${centreX.toFixed(3)})`);

  const triangles = countTriangles(document);
  if (triangles > 40_000) fail(`${triangles} triangles exceeds the low-LOD budget`);
}

/** Depth-first dispose, so a detached skeleton cannot survive in the file. */
function disposeSubtree(node) {
  for (const child of node.listChildren()) disposeSubtree(child);
  node.dispose();
}
