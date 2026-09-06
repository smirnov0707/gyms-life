import { Color, Mesh, MeshStandardMaterial, Texture, type BufferGeometry, type Object3D } from "three";
import { z } from "zod";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { isTwinBodyRegion, TWIN_DISPLAY_COLORS, type TwinBodyRegion, type TwinSceneState } from "./twin-scene.model";

export type HumanAppearance = "natural" | "evidence";
export const HUMAN_ASSET_URL = "/assets/twin/human/gyms-human-cc0-v1.glb";
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/** Skin is presentation. Missing evidence never becomes a positive biological state. */
export function humanRegionTint(state: TwinSceneState, region: TwinBodyRegion, appearance: HumanAppearance) {
  const display = state.regions.find((entry) => entry.id === region)?.display;
  if (appearance === "natural" || !state.dataAvailable || !display || display.value === null || !Number.isFinite(display.value) || display.tone === "unknown") return { color: "#ffffff", amount: 0 };
  return { color: TWIN_DISPLAY_COLORS[display.tone], amount: 0.2 };
}

function releaseObject(root: Object3D) {
  const textures = new Set<Texture>();
  const materials = new Set<MeshStandardMaterial>();
  const geometries = new Set<BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of entries) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  const bitmaps = new Set<{ close: () => void }>();
  for (const texture of textures) {
    const image: unknown = texture.source.data;
    if (typeof image === "object" && image !== null && "close" in image && typeof image.close === "function") bitmaps.add(image as { close: () => void });
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  root.clear();
}

/** One independently owned asset instance. No profile, measurements or new user model. */
export function adoptHumanTwinBody(body: Object3D) {
  const meshes: Mesh[] = [];
  const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
  const regionOf = new Map<Mesh, TwinBodyRegion>();
  const originals = new Map<MeshStandardMaterial, Color>();
  const replaced = new Set<MeshStandardMaterial>();
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (!(object.material instanceof MeshStandardMaterial)) throw new Error("Unsupported human material");
    const previous = object.material;
    const material = previous.clone();
    replaced.add(previous);
    object.material = material;
    originals.set(material, material.color.clone());
    meshes.push(object);
    const region: unknown = object.userData["twinRegion"];
    if (typeof region === "string" && isTwinBodyRegion(region)) {
      regionOf.set(object, region);
      regionMeshes.set(region, [...(regionMeshes.get(region) ?? []), object]);
    }
  });
  for (const material of replaced) material.dispose();
  let disposed = false;
  return {
    body, meshes, regionMeshes, regionOf,
    applyAppearance(state: TwinSceneState, selected: string | null, appearance: HumanAppearance) {
      for (const mesh of meshes) {
        const material = mesh.material as MeshStandardMaterial;
        const original = originals.get(material);
        if (original) material.color.copy(original);
        const region = regionOf.get(mesh);
        if (region) {
          const tint = humanRegionTint(state, region, appearance);
          material.color.lerp(new Color(tint.color), tint.amount);
        }
        material.emissive.set(region && region === selected ? "#aabaca" : "#000000");
        material.emissiveIntensity = region && region === selected ? 0.035 : 0;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseObject(body);
      originals.clear(); regionOf.clear(); regionMeshes.clear();
    },
  };
}
export type HumanTwinBody = ReturnType<typeof adoptHumanTwinBody>;

/** Only the self-contained packaged GLB. No third-party runtime requests. */
export async function loadHumanTwinBody(signal: AbortSignal): Promise<HumanTwinBody> {
  const response = await fetch(HUMAN_ASSET_URL, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Human model is unavailable");
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_ASSET_BYTES) throw new Error("Human model exceeds transfer budget");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_ASSET_BYTES || buffer.byteLength < 20) throw new Error("Invalid human model");
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) throw new Error("Invalid GLB header");
  const jsonLength = header.getUint32(12, true);
  if (20 + jsonLength > buffer.byteLength) throw new Error("Invalid GLB JSON length");
  const uriEntry = z.object({ uri: z.string().optional() }).passthrough();
  const json = z.object({ buffers: z.array(uriEntry).default([]), images: z.array(uriEntry).default([]) }).passthrough().parse(JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))));
  if ([...json.buffers, ...json.images].some((entry) => entry.uri)) throw new Error("External human resource rejected");
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  if (signal.aborted) {
    releaseObject(gltf.scene);
    throw new DOMException("Aborted", "AbortError");
  }
  try { return adoptHumanTwinBody(gltf.scene); }
  catch (error) { releaseObject(gltf.scene); throw error; }
}
