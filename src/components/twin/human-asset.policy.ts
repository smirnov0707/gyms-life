/** Presentation asset admission, never a schema for the user's body or health. */
export type HumanAssetDescriptor = {
  id: string;
  version: string;
  url: string;
  sha256: string;
  byteLength: number;
  license: string;
  attribution: string;
};

export const HUMAN_ASSET_LIMITS = {
  bytes: 8 * 1024 * 1024,
  jsonBytes: 512 * 1024,
  triangles: 100_000,
  meshes: 40,
  nodes: 512,
  textureEdge: 2048,
} as const;

export function validateHumanAssetDescriptor(asset: HumanAssetDescriptor): void {
  if (
    !/^[a-z0-9-]+$/.test(asset.id) ||
    !asset.version ||
    !/^\/assets\/humans\/[a-z0-9/-]+\.glb$/.test(asset.url) ||
    !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    !Number.isSafeInteger(asset.byteLength) ||
    asset.byteLength <= 20 ||
    asset.byteLength > HUMAN_ASSET_LIMITS.bytes ||
    !asset.license.trim() ||
    !asset.attribution.trim()
  )
    throw new Error("Invalid reviewed human asset descriptor");
}

type GlbJson = {
  asset?: { version?: string };
  buffers?: Array<{ uri?: string; byteLength?: number }>;
  images?: Array<{ uri?: string; bufferView?: number; mimeType?: string }>;
  nodes?: unknown[];
  bufferViews?: Array<{ buffer?: number; byteOffset?: number; byteLength?: number }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
};

/** Reject external references before GLTFLoader can start secondary requests. */
export function inspectEmbeddedHumanGlb(buffer: ArrayBuffer): GlbJson {
  if (buffer.byteLength < 28 || buffer.byteLength > HUMAN_ASSET_LIMITS.bytes)
    throw new Error("Human asset transfer budget exceeded or incomplete file");
  const view = new DataView(buffer);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    throw new Error("Expected a complete glTF 2.0 binary");
  const length = view.getUint32(12, true);
  if (length > HUMAN_ASSET_LIMITS.jsonBytes || length % 4 !== 0 || 28 + length > buffer.byteLength)
    throw new Error("Invalid human asset JSON chunk");
  const binHeader = 20 + length;
  const binLength = view.getUint32(binHeader, true);
  if (
    view.getUint32(binHeader + 4, true) !== 0x004e4942 ||
    binLength % 4 !== 0 ||
    binHeader + 8 + binLength !== buffer.byteLength
  )
    throw new Error("Invalid embedded binary chunk");
  const parsed: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid glTF document");
  const json = parsed as GlbJson;
  if (
    json.asset?.version !== "2.0" ||
    !Array.isArray(json.buffers) ||
    json.buffers.length !== 1 ||
    json.buffers.some(
      (entry) =>
        !entry ||
        entry.uri !== undefined ||
        !Number.isSafeInteger(entry.byteLength) ||
        (entry.byteLength ?? 0) <= 0 ||
        (entry.byteLength ?? 0) > binLength ||
        binLength - (entry.byteLength ?? 0) > 3,
    ) ||
    !Array.isArray(json.bufferViews) ||
    json.bufferViews.some(
      (entry) =>
        !entry ||
        entry.buffer !== 0 ||
        !Number.isSafeInteger(entry.byteLength) ||
        (entry.byteLength ?? 0) <= 0 ||
        !Number.isSafeInteger(entry.byteOffset ?? 0) ||
        (entry.byteOffset ?? 0) < 0 ||
        (entry.byteOffset ?? 0) + (entry.byteLength ?? 0) > (json.buffers?.[0]?.byteLength ?? 0),
    ) ||
    !Array.isArray(json.images) ||
    json.images.length < 1 ||
    json.images.length > 16 ||
    json.images.some(
      (image) =>
        !image ||
        image.uri !== undefined ||
        !Number.isSafeInteger(image.bufferView) ||
        (image.bufferView ?? -1) < 0 ||
        (image.bufferView ?? -1) >= (json.bufferViews?.length ?? 0) ||
        !["image/png", "image/jpeg"].includes(image.mimeType ?? ""),
    ) ||
    !Array.isArray(json.nodes) ||
    json.nodes.length > HUMAN_ASSET_LIMITS.nodes ||
    (json.extensionsUsed?.length ?? 0) !== 0 ||
    (json.extensionsRequired?.length ?? 0) !== 0
  )
    throw new Error("Human asset must be self-contained with reviewed PNG/JPEG PBR materials");
  return json;
}

/** A bounded read prevents a misleading Content-Length from bypassing the budget. */
export async function readHumanAssetResponse(response: Response): Promise<ArrayBuffer> {
  if (!response.ok || !response.body) throw new Error("Human asset could not be downloaded");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > HUMAN_ASSET_LIMITS.bytes) {
        await reader.cancel();
        throw new Error("Human asset transfer budget exceeded");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
