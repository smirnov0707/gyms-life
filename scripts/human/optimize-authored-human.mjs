import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { MeshoptSimplifier } from "meshoptimizer";
import path from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: optimize-authored-human.mjs <asset-directory>");
const file = path.join(directory, "gyms-human-cc0-v1.glb");
const bytes = await readFile(file);
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binary = Buffer.from(bytes.subarray(28 + jsonLength));
await MeshoptSimplifier.ready;
function values(id, Constructor) {
  const a = document.accessors[id], v = document.bufferViews[a.bufferView];
  const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Constructor(binary.buffer, binary.byteOffset + offset, a.count * (a.type === "VEC3" ? 3 : 1));
}
for (const mesh of document.meshes) {
  if (!mesh.name.startsWith("human-") && !mesh.name.startsWith("shorts-")) continue;
  const primitive = mesh.primitives[0];
  const indices = values(primitive.indices, Uint32Array);
  const positions = values(primitive.attributes.POSITION, Float32Array);
  const target = Math.floor((indices.length * 0.7) / 3) * 3;
  const [result, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, 0.0015, ["LockBorder"]);
  indices.set(result);
  document.accessors[primitive.indices].count = result.length;
  mesh.extras = { simplificationError: error, regionBordersLocked: true };
}
let text = Buffer.from(JSON.stringify(document));
text = Buffer.concat([text, Buffer.alloc(-text.length & 3, 32)]);
const head = Buffer.alloc(20);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(28 + text.length + binary.length, 8);
head.writeUInt32LE(text.length, 12);
head.writeUInt32LE(0x4e4f534a, 16);
const binhead = Buffer.alloc(8);
binhead.writeUInt32LE(binary.length, 0);
binhead.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([head, text, binhead, binary]);
await writeFile(file, result);
const manifestPath = path.join(directory, "asset-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.meshes = document.meshes.map((mesh) => ({
  name: mesh.name,
  triangles: document.accessors[mesh.primitives[0].indices].count / 3,
  vertices: document.accessors[mesh.primitives[0].attributes.POSITION].count,
  region: document.nodes.find((n) => n.name === mesh.name)?.extras.twinRegion ?? null,
}));
manifest.triangles = manifest.meshes.reduce((n, m) => n + m.triangles, 0);
manifest.bytes = result.length;
manifest.sha256 = createHash("sha256").update(result).digest("hex");
manifest.optimizer = "meshoptimizer 0.22.0; locked region borders; relative error bound 0.0015";
if (manifest.triangles > 100000 || manifest.bytes > 8 * 1024 * 1024) throw new Error("Human asset exceeds the agreed budget");
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ bytes: manifest.bytes, triangles: manifest.triangles, sha256: manifest.sha256 }));
