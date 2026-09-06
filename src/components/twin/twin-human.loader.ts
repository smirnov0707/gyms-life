import { Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isTwinBodyRegion, type TwinBodyRegion } from "./twin-scene.model";

/**
 * Loads the anatomical human and presents it with the same shape the scene
 * already consumes, so the renderer does not learn a second way to hold a body.
 *
 * The figure is a licensed base mesh (see public/models/twin-human.manifest.json).
 * It carries no skin texture: this is a real human form, not a photograph of
 * one, and nothing here pretends otherwise.
 */

/** Region names ride on material names, since glTF primitives have none. */
const REGION_MATERIAL_PREFIX = "twin-region:";

/** Deliberately not a data colour. Skin is a dielectric, so metalness is 0. */
const SKIN = { color: 0xb08872, roughness: 0.64, metalness: 0 };
const FABRIC = { color: 0x232830, roughness: 0.94, metalness: 0 };
/** A blank white sphere reads as a mannequin; without a texture, a dark iris
 *  is the closest honest approximation of an eye. */
const EYE = { color: 0x2a2320, roughness: 0.28, metalness: 0 };

export type TwinBodyModel = {
  body: Group;
  meshes: Mesh[];
  regionMeshes: Map<TwinBodyRegion, Mesh[]>;
  regionOf: Map<Mesh, TwinBodyRegion>;
  /** Base colour per mesh, so a data layer can tint without losing the skin. */
  baseColorOf: Map<Mesh, number>;
  dispose(): void;
};

export type TwinHumanVariant = "male" | "female";

export function twinHumanUrl(variant: TwinHumanVariant): string {
  return `/models/twin-human-${variant}-v1.glb`;
}

/**
 * Resolves with the model, or rejects. Callers keep the surface they already
 * have on rejection — a missing or corrupt asset must never blank the scene.
 */
export function loadTwinHuman(url: string, signal?: AbortSignal): Promise<TwinBodyModel> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (signal?.aborted) {
          disposeObject(gltf.scene);
          reject(new Error("aborted"));
          return;
        }
        try {
          resolve(build(gltf.scene));
        } catch (error) {
          disposeObject(gltf.scene);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      undefined,
      (error) => reject(error instanceof Error ? error : new Error("failed to load the human")),
    );
  });
}

function build(scene: Object3D): TwinBodyModel {
  const body = new Group();
  body.name = "twin-human";
  body.add(scene);

  const meshes: Mesh[] = [];
  const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
  const regionOf = new Map<Mesh, TwinBodyRegion>();
  const baseColorOf = new Map<Mesh, number>();

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const sourceName = materialName(object);
    const region = sourceName.startsWith(REGION_MATERIAL_PREFIX)
      ? sourceName.slice(REGION_MATERIAL_PREFIX.length)
      : null;

    // The file's own materials are replaced so the scene owns every surface it
    // later tints and disposes, rather than mutating the loader's cache.
    const preset = sourceName === "twin-shorts" ? FABRIC : sourceName === "Eyes" ? EYE : SKIN;
    disposeMaterial(object);
    object.material = new MeshStandardMaterial(preset);
    baseColorOf.set(object, preset.color);
    meshes.push(object);

    if (region && isTwinBodyRegion(region)) {
      regionOf.set(object, region);
      const existing = regionMeshes.get(region);
      if (existing) existing.push(object);
      else regionMeshes.set(region, [object]);
    }
  });

  if (regionMeshes.size === 0) {
    throw new Error("the human carries no region materials; region selection would be dead");
  }

  let disposed = false;
  return {
    body,
    meshes,
    regionMeshes,
    regionOf,
    baseColorOf,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObject(body);
      regionMeshes.clear();
      regionOf.clear();
      baseColorOf.clear();
      meshes.length = 0;
    },
  };
}

function materialName(mesh: Mesh): string {
  const material = mesh.material;
  return Array.isArray(material) ? (material[0]?.name ?? "") : (material?.name ?? "");
}

function disposeMaterial(mesh: Mesh): void {
  const material = mesh.material;
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
  else material?.dispose();
}

/** Frees GPU memory for a subtree; a leaked skinned mesh is megabytes. */
function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    disposeMaterial(object);
  });
  root.clear();
}
