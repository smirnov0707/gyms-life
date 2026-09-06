/** Offline adaptation of Microsoft Rocketbox Male_Adult_01 (MIT).
 * Node/Three is used for FBX geometry, not a second browser renderer.
 * Texture conversion requires Pillow. Source hashes are checked before use.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Loader,
  LoadingManager,
  MeshStandardMaterial,
  Quaternion,
  SkinnedMesh,
  Texture,
  Vector3,
  DoubleSide,
} from "three";

const source = path.resolve(process.argv[2] ?? "public/.candidate-src");
const output = path.resolve(process.argv[3] ?? "public/assets/humans/rocketbox-adult-01-v1");
await fs.mkdir(output, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(source, "source-manifest.json"), "utf8"));
if (
  manifest.license !== "MIT" ||
  manifest.upstreamRef !== "0943055db6ec570bcef9f2c8b41c9e5467c808f9"
)
  throw new Error("Unexpected source identity");
for (const file of manifest.files) {
  const data = await fs.readFile(path.join(source, path.basename(file.source)));
  if (crypto.createHash("sha256").update(data).digest("hex") !== file.sha256)
    throw new Error("Source integrity failed");
}
execFileSync("python3", [
  path.join(path.dirname(fileURLToPath(import.meta.url)), "prepare-textures.py"),
  source,
  output,
]);
class LocalTextureReference extends Loader {
  load(url) {
    const texture = new Texture();
    texture.userData.sourceName = url.split(/[\\/]/).pop();
    return texture;
  }
}
const manager = new LoadingManager().addHandler(/\.tga$/i, new LocalTextureReference());
const bytes = await fs.readFile(path.join(source, "Male_Adult_01.fbx"));
const original = new FBXLoader(manager).parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const incidentalLights = [];
original.traverse((node) => {
  if (node.isLight || node.isCamera) incidentalLights.push(node);
});
for (const node of incidentalLights) node.removeFromParent();
original.updateMatrixWorld(true);
// Pose the supplied rig, rather than deforming body dimensions from user data.
const allBones = [];
original.traverse((node) => {
  if (node.isBone) allBones.push(node);
});
for (const side of ["L", "R"]) {
  const arm = allBones.find((b) => b.name === `Bip01_${side}_UpperArm`);
  const elbow = allBones.find((b) => b.name === `Bip01_${side}_Forearm`);
  if (!arm || !elbow) throw new Error("Expected source arm rig missing");
  const from = elbow
    .getWorldPosition(new Vector3())
    .sub(arm.getWorldPosition(new Vector3()))
    .normalize();
  const to = new Vector3(side === "L" ? 0.35 : -0.35, -0.93, 0.06).normalize();
  const delta = new Quaternion().setFromUnitVectors(from, to);
  const parent = arm.parent.getWorldQuaternion(new Quaternion());
  const world = arm.getWorldQuaternion(new Quaternion());
  arm.quaternion.copy(parent.invert().multiply(delta).multiply(world));
  original.updateMatrixWorld(true);
}
const wrapper = new Group();
wrapper.name = "rocketbox-adult-01-generic-review";
wrapper.add(original);
let bounds = new Box3().setFromObject(wrapper, true);
const scale = 1.86 / (bounds.max.y - bounds.min.y);
wrapper.scale.setScalar(scale);
wrapper.updateMatrixWorld(true);
bounds = new Box3().setFromObject(wrapper, true);
const centre = bounds.getCenter(new Vector3());
wrapper.position.set(-centre.x, -bounds.min.y, -centre.z);
wrapper.updateMatrixWorld(true);

// Coarse anatomical presentation labels authored for this ONE pinned asset.
// These are not inferred muscle measurements. Raycasts use the real surface.
function regionFor(mesh, indices, p) {
  const influences = new Map();
  const skin = mesh.geometry.getAttribute("skinIndex");
  const weights = mesh.geometry.getAttribute("skinWeight");
  for (const i of indices)
    for (let c = 0; c < 4; c++) {
      const name = mesh.skeleton.bones[skin.getComponent(i, c)]?.name ?? "";
      influences.set(name, (influences.get(name) ?? 0) + weights.getComponent(i, c));
    }
  const bone = [...influences].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (/Head|Neck|Eye|Jaw|Lip|Tongue|Teeth|Nose|Brow|Cheek/.test(bone) || p.y > 1.57)
    return "neutral";
  if (/Arm|Hand|Finger|Thumb/.test(bone))
    return p.y > 1.38 && Math.abs(p.x) < 0.26 ? "shoulders" : "arms";
  if (/Clavicle/.test(bone)) return "shoulders";
  if (/Thigh|Calf|Foot|Toe/.test(bone)) return "legs";
  if (p.y < 0.98) return p.z < 0 ? "glutes" : "core";
  if (p.z < 0) return "back";
  if (p.y > 1.3) return "chest";
  return Math.abs(p.x) > 0.12 ? "core" : "abs";
}
const sourceMeshes = [];
original.traverse((node) => {
  if (node.isMesh) sourceMeshes.push(node);
});
const stats = {
  sourceTriangles: 0,
  triangles: 0,
  vertices: 0,
  meshCount: 0,
  regions: {},
  bounds: null,
};
for (const mesh of sourceMeshes) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const count = index ? index.count : position.count;
  stats.sourceTriangles += count / 3;
  const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const buckets = new Map();
  for (let offset = 0; offset < count; offset += 3) {
    const indices = [0, 1, 2].map((delta) => (index ? index.getX(offset + delta) : offset + delta));
    const centroid = new Vector3();
    for (const i of indices)
      centroid.add(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
    centroid.divideScalar(3);
    const materialIndex =
      geometry.groups.find((g) => offset >= g.start && offset < g.start + g.count)?.materialIndex ??
      0;
    const region =
      sourceMaterials[materialIndex].name.includes("head") ||
      sourceMaterials[materialIndex].name.includes("opacity")
        ? "neutral"
        : regionFor(mesh, indices, centroid);
    const key = region + ":" + materialIndex;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(...indices);
  }
  for (const [key, indices] of buckets) {
    const [region, materialIndexText] = key.split(":");
    const sourceMaterial = sourceMaterials[Number(materialIndexText)];
    const geo = new BufferGeometry();
    for (const name of Object.keys(geometry.attributes)) {
      const attribute = geometry.getAttribute(name);
      const array = new attribute.array.constructor(indices.length * attribute.itemSize);
      indices.forEach((v, j) => {
        for (let c = 0; c < attribute.itemSize; c++)
          array[j * attribute.itemSize + c] = attribute.getComponent(v, c);
      });
      geo.setAttribute(name, new BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    const material = new MeshStandardMaterial({
      name: sourceMaterial.name + "-" + region,
      color: "#ffffff",
      roughness: sourceMaterial.name.includes("head") ? 0.68 : 0.85,
      metalness: 0,
      side: sourceMaterial.name.includes("opacity") ? DoubleSide : 0,
      alphaTest: sourceMaterial.name.includes("opacity") ? 0.45 : 0,
    });
    material.userData = { sourceMaterial: sourceMaterial.name };
    const part = new SkinnedMesh(geo, material);
    part.name = `human-${region}-${materialIndexText}`;
    part.position.copy(mesh.position);
    part.quaternion.copy(mesh.quaternion);
    part.scale.copy(mesh.scale);
    part.bind(mesh.skeleton, mesh.bindMatrix);
    part.bindMode = mesh.bindMode;
    part.userData = { twinRegion: region };
    mesh.parent.add(part);
    stats.triangles += indices.length / 3;
    stats.vertices += indices.length;
    stats.meshCount++;
    stats.regions[region] = (stats.regions[region] ?? 0) + indices.length / 3;
  }
  mesh.removeFromParent();
}
wrapper.updateMatrixWorld(true);
bounds = new Box3().setFromObject(wrapper, true);
stats.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
// GLTFExporter only needs FileReader for its generated buffers; no browser I/O.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result =
        "data:application/octet-stream;base64," + Buffer.from(result).toString("base64");
      this.onloadend?.();
    });
  }
};
const exported = await new GLTFExporter().parseAsync(wrapper, {
  binary: true,
  onlyVisible: true,
  animations: [],
});
const originalGLB = Buffer.from(exported);
const jsonLength = originalGLB.readUInt32LE(12);
const gltf = JSON.parse(originalGLB.subarray(20, 20 + jsonLength).toString());
const binStart = 20 + jsonLength + 8;
const buffers = [originalGLB.subarray(binStart)];
let binLength = buffers[0].length;
gltf.images = [];
gltf.textures = [];
gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
const textures = new Map();
for (const filename of [
  "m002_body_color.jpg",
  "m002_head_color.jpg",
  "m002_opacity_color.png",
  "m002_body_normal.png",
  "m002_head_normal.png",
]) {
  const image = await fs.readFile(path.join(output, filename));
  const imageIndex = gltf.images.length;
  const viewIndex = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: binLength, byteLength: image.length });
  gltf.images.push({
    bufferView: viewIndex,
    mimeType: filename.endsWith(".jpg") ? "image/jpeg" : "image/png",
    name: filename,
  });
  gltf.textures.push({ source: imageIndex, sampler: 0 });
  textures.set(filename, imageIndex);
  const pad = Buffer.alloc((4 - (image.length % 4)) % 4);
  buffers.push(image, pad);
  binLength += image.length + pad.length;
}
for (const material of gltf.materials) {
  const sourceName = material.extras.sourceMaterial;
  const filename = sourceName + "_color" + (sourceName.includes("opacity") ? ".png" : ".jpg");
  material.pbrMetallicRoughness.baseColorTexture = { index: textures.get(filename) };
  if (!sourceName.includes("opacity"))
    material.normalTexture = { index: textures.get(sourceName + "_normal.png"), scale: 0.45 };
}
gltf.buffers = [{ byteLength: binLength }];
gltf.asset.copyright =
  "Copyright (c) 2020 Microsoft. MIT License. Modified GYMS.LIFE review candidate.";
const json = Buffer.from(JSON.stringify(gltf));
const paddedJson = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + paddedJson.length + 8 + binLength, 8);
header.writeUInt32LE(paddedJson.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binLength, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, paddedJson, binHeader, ...buffers]);
if (glb.length > 8 * 1024 * 1024) throw new Error("Mobile transfer budget exceeded");
await fs.writeFile(path.join(output, "human.glb"), glb);
await fs.copyFile(path.join(source, "LICENSE.md"), path.join(output, "LICENSE.txt"));
await fs.writeFile(
  path.join(output, "source-manifest.json"),
  JSON.stringify(
    {
      ...manifest,
      adaptation:
        "Posed supplied rig; coarse authored surface regions; embedded 2K colour/1K normals/alpha; constant roughness; no measured physiology or personalization.",
      output: {
        sha256: crypto.createHash("sha256").update(glb).digest("hex"),
        bytes: glb.length,
        ...stats,
      },
    },
    null,
    2,
  ),
);
await fs.writeFile(
  path.resolve("src/components/twin/human-asset.candidate.json"),
  JSON.stringify(
    {
      id: "rocketbox-adult-01",
      version: "1-review",
      url: "/assets/humans/rocketbox-adult-01-v1/human.glb",
      sha256: crypto.createHash("sha256").update(glb).digest("hex"),
      byteLength: glb.length,
      license: "MIT",
      attribution:
        "Microsoft Rocketbox — Copyright (c) 2020 Microsoft. Modified GYMS.LIFE review candidate.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    { bytes: glb.length, sha256: crypto.createHash("sha256").update(glb).digest("hex"), ...stats },
    null,
    2,
  ),
);
for (const filename of textures.keys()) await fs.unlink(path.join(output, filename));
