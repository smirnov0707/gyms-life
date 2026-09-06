import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import candidate from "./human-asset.candidate.json";
import { HUMAN_ASSET_LIMITS, inspectEmbeddedHumanGlb, readHumanAssetResponse, validateHumanAssetDescriptor } from "./human-asset.policy";

const bytes = readFileSync(`public${candidate.url}`);
const assetBuffer = () => Uint8Array.from(bytes).buffer;
function tinyGlb(overrides: Record<string, unknown> = {}) {
  const json = new TextEncoder().encode(JSON.stringify({
    asset: { version: "2.0" }, buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    images: [{ bufferView: 0, mimeType: "image/png" }], nodes: [], ...overrides,
  }));
  const n = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(28 + n + 4);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true); view.setUint32(12, n, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, n).fill(32); new Uint8Array(buffer, 20, json.length).set(json);
  view.setUint32(20 + n, 4, true); view.setUint32(24 + n, 0x004e4942, true);
  return buffer;
}

describe("reviewed human asset admission", () => {
  it("admits the actual versioned, embedded candidate and pins its content", () => {
    expect(() => validateHumanAssetDescriptor(candidate)).not.toThrow();
    const doc = inspectEmbeddedHumanGlb(assetBuffer());
    expect(doc.asset?.version).toBe("2.0");
    expect(bytes.byteLength).toBe(candidate.byteLength);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(candidate.sha256);
    expect(bytes.byteLength).toBeLessThanOrEqual(HUMAN_ASSET_LIMITS.bytes);
    expect(readFileSync("public/assets/humans/rocketbox-adult-01-v1/LICENSE.txt", "utf8"))
      .toContain("Copyright (c) 2020 Microsoft");
  });
  it.each([
    { url: "https://third-party.invalid/person.glb" }, { url: "//third-party.invalid/person.glb" },
    { url: "/assets/humans/../person.glb" }, { url: "/assets/humans/person.glb?user=private" },
    { byteLength: HUMAN_ASSET_LIMITS.bytes + 1 }, { sha256: "not-a-hash" }, { license: "" },
  ])("rejects an unreviewed descriptor: %j", (patch) => {
    expect(() => validateHumanAssetDescriptor({ ...candidate, ...patch })).toThrow();
  });
  it.each([
    { buffers: [{ byteLength: 4, uri: "https://external.invalid/private" }] },
    { images: [{ uri: "https://external.invalid/texture.png" }] },
    { images: [{ bufferView: 99, mimeType: "image/png" }] }, { buffers: [{ byteLength: 1000 }] },
    { bufferViews: [{ buffer: 0, byteOffset: -1, byteLength: 4 }] },
    { bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 4 }] },
    { extensionsUsed: ["KHR_draco_mesh_compression"] }, { images: [null] }, { nodes: Array(513).fill({}) },
  ])("rejects external, malformed or unreviewed GLB features: %j", (patch) => {
    expect(() => inspectEmbeddedHumanGlb(tinyGlb(patch))).toThrow();
  });
  it("rejects truncation and incorrect binary chunk headers", () => {
    const buffer = tinyGlb();
    expect(() => inspectEmbeddedHumanGlb(buffer.slice(0, -4))).toThrow();
    new DataView(buffer).setUint32(buffer.byteLength - 8, 0x12345678, true);
    expect(() => inspectEmbeddedHumanGlb(buffer)).toThrow();
  });
  it("reads real chunks and rejects 404 rather than parsing it as a model", async () => {
    const data = await readHumanAssetResponse(new Response(new Uint8Array([1, 2, 3])));
    expect([...new Uint8Array(data)]).toEqual([1, 2, 3]);
    await expect(readHumanAssetResponse(new Response("missing", { status: 404 }))).rejects.toThrow();
  });
  it("enforces actual transfer size even if Content-Length lies", async () => {
    await expect(readHumanAssetResponse(new Response(new Uint8Array(HUMAN_ASSET_LIMITS.bytes + 1),
      { headers: { "Content-Length": "1" } }))).rejects.toThrow("budget");
  });
});
