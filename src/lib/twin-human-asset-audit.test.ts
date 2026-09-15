import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/audit-twin-human-asset.mjs", import.meta.url));
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true })));

// Synthetic metadata fixture, deliberately NOT a human or a rendering-quality sample.
// The command reports metadata only; it must never claim this is a validated glTF/human.
function document() {
  return {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 64 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 64 }],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 0, componentType: 5126, type: "VEC2", count: 3 },
    ],
    images: [{ bufferView: 0, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
  };
}

function glb(value: object) {
  const json = Buffer.from(JSON.stringify(value));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const bytes = Buffer.alloc(12 + 8 + padded.length + 8 + 64);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(padded.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(bytes, 20);
  bytes.writeUInt32LE(64, 20 + padded.length);
  bytes.writeUInt32LE(0x004e4942, 24 + padded.length);
  return bytes;
}

function run(bytes: Buffer, rights?: object) {
  const folder = mkdtempSync(join(tmpdir(), "twin-human-intake-"));
  directories.push(folder);
  const asset = join(folder, "synthetic.glb");
  writeFileSync(asset, bytes);
  const args = [script, asset];
  if (rights) {
    const path = join(folder, "rights.json");
    writeFileSync(path, JSON.stringify(rights));
    args.push(path);
  }
  return spawnSync(process.execPath, args, { encoding: "utf8", timeout: 10_000 });
}

function rightsFor(bytes: Buffer) {
  return {
    assetSha256: createHash("sha256").update(bytes).digest("hex"),
    creator: "Synthetic test only",
    sourceUrl: "https://example.invalid/synthetic-test",
    licenseName: "TEST ONLY — NOT AN ACTUAL ASSET LICENCE",
    evidenceReference: "synthetic-test-assertions-only",
    permissions: {
      commercialWebApp: "approved",
      browserDelivery: "approved",
      publicRepository: "approved",
    },
  };
}

describe("Human realism asset intake", () => {
  it("does not promote a passing metadata fixture into visual or production approval", () => {
    const bytes = glb(document());
    const result = run(bytes, rightsFor(bytes));
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.technicalPreflightPassed).toBe(true);
    expect(report.rightsRecordComplete).toBe(true);
    expect(report.visuallyAccepted).toBe(false);
    expect(report.productionEligible).toBe(false);
    expect(report.observed.storedPrimitiveTriangles).toBe(1);
    expect(report.observed.framesPerSecond).toBeNull();
    expect(report.observed.gpuMemoryBytes).toBeNull();
    expect(report.observed.decodedTextureDimensions).toBeNull();
  });

  it("requires a rights record tied to the exact file", () => {
    const bytes = glb(document());
    expect(run(bytes).status).toBe(2);
    expect(run(bytes, { ...rightsFor(bytes), assetSha256: "wrong" }).status).toBe(2);
  });

  it.each(["commercialWebApp", "browserDelivery", "publicRepository"])(
    "does not infer %s rights from other permissions",
    (field) => {
      const bytes = glb(document());
      const rights = rightsFor(bytes);
      const result = run(bytes, {
        ...rights,
        permissions: { ...rights.permissions, [field]: "pending" },
      });
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).rightsRecordComplete).toBe(false);
    },
  );

  it("rejects missing UVs rather than treating a coloured mannequin as a textured human", () => {
    const source = document();
    const bytes = glb({
      ...source,
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    });
    const result = run(bytes, rightsFor(bytes));
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).checks).toContainEqual({
      id: "uv",
      passed: false,
      message: "Every primitive needs UV0",
    });
  });

  it("does not follow or expose external texture URLs", () => {
    const bytes = glb({ ...document(), images: [{ uri: "https://example.invalid/private.png" }] });
    const result = run(bytes, rightsFor(bytes));
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain("private.png");
  });

  it("requires decoder review instead of silently claiming compressed assets work", () => {
    const bytes = glb({ ...document(), extensionsRequired: ["KHR_texture_basisu"] });
    expect(run(bytes, rightsFor(bytes)).status).toBe(2);
  });

  it("rejects out-of-bounds buffer views", () => {
    const bytes = glb({
      ...document(),
      bufferViews: [{ buffer: 0, byteOffset: 60, byteLength: 64 }],
    });
    expect(run(bytes).status).toBe(1);
  });

  it("rejects broken texture references", () => {
    const bytes = glb({ ...document(), textures: [{ source: 99 }] });
    expect(run(bytes).status).toBe(1);
  });

  it("rejects a truncated binary", () => {
    const bytes = glb(document());
    expect(run(bytes.subarray(0, bytes.length - 1)).status).toBe(1);
  });

  it("rejects the wrong container version", () => {
    const bytes = glb(document());
    bytes.writeUInt32LE(1, 4);
    expect(run(bytes).status).toBe(1);
  });

  it("never imports the intake command into the production renderer", () => {
    const runtime = readFileSync(
      fileURLToPath(new URL("../components/twin/twin-scene.runtime.ts", import.meta.url)),
      "utf8",
    );
    expect(runtime).not.toContain("audit-twin-human-asset");
  });
});
