import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Read only the shipped generic assets. Never loads a personal Identity Shell.
const assets = [];
for (const file of ["twin-selected-v1.glb", "twin-body-v2.glb"]) {
  const bytes = await readFile(path.join("public/models", file));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const end = 20 + bytes.readUInt32LE(12);
  assert.ok(end <= bytes.length);
  const gltf = JSON.parse(bytes.toString("utf8", 20, end).trim());
  const regions = [];
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const primitive of mesh.primitives ?? []) {
      const material = gltf.materials?.[primitive.material]?.name ?? "unnamed";
      if (!material.startsWith("twin-region:")) continue;
      const nodes = (gltf.nodes ?? []).filter((node) => node.mesh === meshIndex);
      const extras = [mesh.extras, ...nodes.map((node) => node.extras)].filter(Boolean);
      const attributes = Object.keys(primitive.attributes ?? {});
      const count =
        gltf.accessors?.[primitive.indices]?.count ??
        gltf.accessors?.[primitive.attributes?.POSITION]?.count ??
        0;
      regions.push({
        region: material.slice("twin-region:".length),
        triangles: (primitive.mode ?? 4) === 4 ? count / 3 : null,
        attributes,
        regionMaskMetadata: extras.some((value) => value.twinRegionMask === true),
        contourMetadata: extras.some((value) => Array.isArray(value.twinSculptContours)),
        extraKeys: [...new Set(extras.flatMap((value) => Object.keys(value)))],
      });
    }
  }
  assert.ok(regions.length > 0, `${file}: no region surfaces found`);
  assets.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), regions });
}
const report = {
  scope: "Read-only generic GLB metadata; not a contour fix or a claim of anatomical accuracy.",
  assets,
};
await mkdir("test-results/twin-layer-controls", { recursive: true });
await writeFile(
  "test-results/twin-layer-controls/asset-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
