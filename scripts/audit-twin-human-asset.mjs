import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import process from "node:process";

// Offline asset intake only. Never imported by the application or given user data.
// This is a bounded metadata preflight, NOT a full glTF validator or visual approval.
const MAX_INSPECTION_BYTES = 64 * 1024 * 1024;
const MOBILE_TRANSFER_TARGET = 8 * 1024 * 1024;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function array(value, name) {
  if (value === undefined) return [];
  requireCondition(Array.isArray(value), `${name} must be an array`);
  return value;
}

function indexIn(index, values, label) {
  requireCondition(Number.isSafeInteger(index) && index >= 0, `${label}: invalid index`);
  requireCondition(index < values.length, `${label}: missing reference`);
  return values[index];
}

function parseGlb(bytes) {
  requireCondition(bytes.length >= 20, "Truncated GLB header");
  requireCondition(bytes.readUInt32LE(0) === 0x46546c67, "Expected glTF binary magic");
  requireCondition(bytes.readUInt32LE(4) === 2, "Only GLB version 2 is inspected");
  requireCondition(bytes.readUInt32LE(8) === bytes.length, "GLB length does not match file");
  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    requireCondition(offset + 8 <= bytes.length, "Truncated chunk header");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    requireCondition(length % 4 === 0, "GLB chunks must be four-byte aligned");
    requireCondition(offset + 8 + length <= bytes.length, "Chunk exceeds GLB boundary");
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  requireCondition(chunks[0]?.type === JSON_CHUNK, "First chunk must contain JSON");
  requireCondition(
    chunks.length === 1 || (chunks.length === 2 && chunks[1].type === BIN_CHUNK),
    "Intake supports one JSON chunk and at most one embedded BIN chunk",
  );
  const document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(chunks[0].bytes));
  requireCondition(document?.asset?.version === "2.0", "Expected glTF 2.0 asset metadata");
  return { document, binaryBytes: chunks[1]?.bytes.length ?? 0 };
}

function inspect(bytes, rights) {
  const { document: doc, binaryBytes } = parseGlb(bytes);
  const checks = [];
  const check = (id, passed, message) => checks.push({ id, passed, message });
  const buffers = array(doc.buffers, "buffers");
  const views = array(doc.bufferViews, "bufferViews");
  const accessors = array(doc.accessors, "accessors");
  const meshes = array(doc.meshes, "meshes");
  const materials = array(doc.materials, "materials");
  const images = array(doc.images, "images");
  const textures = array(doc.textures, "textures");
  const nodes = array(doc.nodes, "nodes");
  const extensions = [
    ...array(doc.extensionsUsed, "extensionsUsed"),
    ...array(doc.extensionsRequired, "extensionsRequired"),
  ];
  // No URI is followed, logged or treated as proof of ownership.
  const externalResources = [...buffers, ...images].some((entry) => entry.uri !== undefined);
  check("embedded_resources", !externalResources, "All buffers and images must be embedded");
  check(
    "decoder_review",
    extensions.length === 0,
    "This first intake requires explicit review of any extension/decoder before integration",
  );
  requireCondition(buffers.length <= 1, "Self-contained GLB supports one embedded buffer");
  for (const buffer of buffers) {
    if (buffer.uri !== undefined) continue;
    requireCondition(
      Number.isSafeInteger(buffer.byteLength) && buffer.byteLength >= 0,
      "Invalid embedded buffer length",
    );
    requireCondition(
      buffer.byteLength <= binaryBytes && binaryBytes - buffer.byteLength <= 3,
      "Embedded buffer does not match BIN payload",
    );
  }
  for (const view of views) {
    const buffer = indexIn(view.buffer, buffers, "bufferView.buffer");
    const start = view.byteOffset ?? 0;
    requireCondition(
      Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(view.byteLength),
      "Invalid bufferView range",
    );
    requireCondition(
      view.byteLength >= 0 && start + view.byteLength <= buffer.byteLength,
      "bufferView exceeds its buffer",
    );
  }
  for (const image of images) {
    if (image.uri === undefined) indexIn(image.bufferView, views, "image.bufferView");
  }
  const textureInfoExists = (info) => {
    if (!info) return false;
    const texture = indexIn(info.index, textures, "material texture");
    // Extension-specific texture sources are intentionally not claimed as decoded.
    if (texture.source === undefined) return false;
    indexIn(texture.source, images, "texture.source");
    return true;
  };
  let triangles = 0;
  let primitiveCount = 0;
  let uvPrimitives = 0;
  let texturedPrimitives = 0;
  let normalMappedPrimitives = 0;
  let unsupportedModes = 0;
  for (const mesh of meshes) {
    for (const primitive of array(mesh.primitives, "mesh.primitives")) {
      primitiveCount += 1;
      const position = indexIn(primitive.attributes?.POSITION, accessors, "POSITION");
      requireCondition(position.type === "VEC3", "POSITION must be a VEC3 accessor");
      requireCondition(
        Number.isSafeInteger(position.count) && position.count > 0,
        "Invalid vertex count",
      );
      const uvIndex = primitive.attributes?.TEXCOORD_0;
      if (uvIndex !== undefined) {
        const uv = indexIn(uvIndex, accessors, "TEXCOORD_0");
        requireCondition(uv.type === "VEC2" && uv.count === position.count, "Invalid UV accessor");
        uvPrimitives += 1;
      }
      if ((primitive.mode ?? 4) !== 4) {
        unsupportedModes += 1;
      } else {
        const count =
          primitive.indices === undefined
            ? position.count
            : indexIn(primitive.indices, accessors, "indices").count;
        requireCondition(
          Number.isSafeInteger(count) && count > 0 && count % 3 === 0,
          "Invalid triangle-list count",
        );
        triangles += count / 3;
        requireCondition(Number.isSafeInteger(triangles), "Triangle count overflow");
      }
      if (primitive.material !== undefined) {
        const material = indexIn(primitive.material, materials, "primitive.material");
        if (textureInfoExists(material.pbrMetallicRoughness?.baseColorTexture)) {
          texturedPrimitives += 1;
        }
        if (textureInfoExists(material.normalTexture)) normalMappedPrimitives += 1;
      }
    }
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  check("transfer_budget", bytes.length <= MOBILE_TRANSFER_TARGET, "Mobile target: at most 8 MiB");
  check(
    "geometry",
    primitiveCount > 0 && unsupportedModes === 0,
    "Triangle-list geometry required",
  );
  check("geometry_budget", triangles <= 100_000, "At most 100,000 stored primitive triangles");
  check("uv", uvPrimitives === primitiveCount && primitiveCount > 0, "Every primitive needs UV0");
  check("albedo", texturedPrimitives > 0, "At least one referenced base-color texture required");
  const permissionFields = ["commercialWebApp", "browserDelivery", "publicRepository"];
  const rightsRecorded =
    rights?.assetSha256 === sha256 &&
    typeof rights?.creator === "string" &&
    rights.creator.trim().length > 0 &&
    typeof rights?.sourceUrl === "string" &&
    rights.sourceUrl.startsWith("https://") &&
    typeof rights?.licenseName === "string" &&
    rights.licenseName.trim().length > 0 &&
    typeof rights?.evidenceReference === "string" &&
    rights.evidenceReference.trim().length > 0 &&
    permissionFields.every((field) => rights?.permissions?.[field] === "approved");
  return {
    reportVersion: 1,
    scope: "offline_metadata_preflight_only",
    sha256,
    observed: {
      transferBytes: bytes.length,
      storedPrimitiveTriangles: triangles,
      primitiveCount,
      uvPrimitives,
      texturedPrimitives,
      normalMappedPrimitives,
      materialCount: materials.length,
      embeddedImageCount: images.filter((image) => image.uri === undefined).length,
      skinnedNodeCount: nodes.filter((node) => node.skin !== undefined).length,
      animationClipCount: array(doc.animations, "animations").length,
      drawCalls: null,
      framesPerSecond: null,
      gpuMemoryBytes: null,
      decodedTextureDimensions: null,
    },
    checks,
    technicalPreflightPassed: checks.every((entry) => entry.passed),
    rightsRecordComplete: Boolean(rightsRecorded),
    rightsMeaning: "Recorded operator assertions, not automated verification of legal rights",
    visuallyAccepted: false,
    productionEligible: false,
    remainingGates: [
      "Full glTF validation and actual decoder/texture checks",
      "Asset-specific region mapping and occlusion tests",
      "Model release, clothing, face, hands and multi-angle visual review",
      "Measured rendering performance and lifecycle/fallback tests",
      "Owner visual approval and separate reviewed production release",
    ],
  };
}

try {
  const [assetPath, rightsPath, outputPath] = process.argv.slice(2);
  requireCondition(
    assetPath,
    "Usage: node scripts/audit-twin-human-asset.mjs model.glb [rights.json] [report.json]",
  );
  const size = statSync(assetPath).size;
  requireCondition(size <= MAX_INSPECTION_BYTES, "Asset exceeds 64 MiB inspection limit");
  const bytes = readFileSync(assetPath);
  requireCondition(bytes.length <= MAX_INSPECTION_BYTES, "Asset grew beyond inspection limit");
  const rights = rightsPath ? JSON.parse(readFileSync(rightsPath, "utf8")) : null;
  const report = inspect(bytes, rights);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) writeFileSync(outputPath, json, { flag: "wx" });
  process.stdout.write(json);
  process.exitCode = report.technicalPreflightPassed && report.rightsRecordComplete ? 0 : 2;
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ error: error instanceof Error ? error.message : "Inspection failed" })}\n`,
  );
  process.exitCode = 1;
}
