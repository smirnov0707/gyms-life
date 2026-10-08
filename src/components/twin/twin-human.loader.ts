import { Group, Mesh, type Object3D } from "three";
import { createTwinBoundaryMask } from "./twin-region-boundary";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isTwinBodyRegion, type TwinBodyRegion } from "./twin-scene.model";
import { createTwinAnatomyMaterial } from "./twin-anatomy.material";
import { TWIN_SKIN_MATERIAL, TWIN_EYE_MATERIAL } from "./twin-surface.style";
import { parseTwinSculptContours, parseTwinSculptCompetition } from "./twin-sculpt.contours";
import {
  MAX_TWIN_ASSET_BYTES,
  TWIN_REGISTERED_ASSETS,
  verifyTwinAsset,
  type TwinBodyProvenance,
} from "./twin-body.provenance";

/**
 * Loads the anatomical human and presents it with the same shape the scene
 * already consumes, so the renderer does not learn a second way to hold a body.
 *
 * Analysis uses the explicitly selected MakeHuman presentation surface; Body
 * retains the separate continuous-skin shell. Both are generic models. Their
 * exact registered bytes determine provenance and review status.
 */

/** Region names ride on material names, since glTF primitives have none. */
const REGION_MATERIAL_PREFIX = "twin-region:";

// The two appearances keep their own geometry, but the neutral surface is skin,
// not near-black metal. Region colours are applied by the shared visual policy.

export type TwinBodyModel = {
  provenance: TwinBodyProvenance;
  body: Group;
  meshes: Mesh[];
  regionMeshes: Map<TwinBodyRegion, Mesh[]>;
  regionOf: Map<Mesh, TwinBodyRegion>;
  /** Base colour per mesh, so a data layer can tint without losing the skin. */
  baseColorOf: Map<Mesh, number>;
  dispose(): void;
};

export type TwinHumanVariant = "male" | "female";
export type TwinVisualAppearance = "analysis" | "realistic";

/** Generic presentation surfaces: the variant does not imply a personal body scan. */
export function twinHumanUrl(
  _variant: TwinHumanVariant,
  appearance: TwinVisualAppearance = "analysis",
): string {
  return appearance === "realistic" ? "/models/twin-body-v2.glb" : "/models/twin-selected-v1.glb";
}

/**
 * Resolves with the model, or rejects. Callers keep the surface they already
 * have on rejection — a missing or corrupt asset must never blank the scene.
 */
export async function loadTwinHuman(
  url: string,
  signal?: AbortSignal,
  appearance: TwinVisualAppearance = "analysis",
): Promise<TwinBodyModel> {
  signal?.throwIfAborted();
  const response = await fetch(url, { signal: signal ?? null });
  if (!response.ok) throw new Error(`Twin asset request failed (${response.status})`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_TWIN_ASSET_BYTES)
    throw new Error("Twin asset exceeds the supported size");
  const bytes = await response.arrayBuffer();
  signal?.throwIfAborted();
  const provenance = await verifyTwinAsset(bytes);
  signal?.throwIfAborted();
  // All registered assets are self-contained GLBs. Verify the bytes before
  // parsing: neither an overridden URL nor glTF extras can claim a source.
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  try {
    signal?.throwIfAborted();
    return build(gltf.scene, provenance, appearance);
  } catch (error) {
    disposeObject(gltf.scene);
    throw error;
  }
}

function build(
  scene: Object3D,
  provenance: TwinBodyProvenance,
  appearance: TwinVisualAppearance,
): TwinBodyModel {
  const body = new Group();
  body.name = "twin-human";
  body.add(scene);

  const meshes: Mesh[] = [];
  const regionMeshes = new Map<TwinBodyRegion, Mesh[]>();
  const regionOf = new Map<Mesh, TwinBodyRegion>();
  const baseColorOf = new Map<Mesh, number>();

  // Collected first: adding a child inside a traverse would have the traversal
  // walk straight into it.
  const surfaces: Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) surfaces.push(object);
  });
  for (const object of surfaces) {
    const sourceName = materialName(object);
    const region = sourceName.startsWith(REGION_MATERIAL_PREFIX)
      ? sourceName.slice(REGION_MATERIAL_PREFIX.length)
      : null;

    // The file's own materials are replaced so the scene owns every surface it
    // later tints and disposes, rather than mutating the loader's cache.
    // The kept skin is the one mesh that is not a region: it carries no
    // reading, so it is the silhouette rather than a data surface.
    const preset = sourceName === "Eyes" ? TWIN_EYE_MATERIAL : TWIN_SKIN_MATERIAL;
    const featherBack =
      appearance === "realistic" &&
      region === "back" &&
      provenance.sha256 ===
        TWIN_REGISTERED_ASSETS.find((asset) => asset.path === "public/models/twin-body-v2.glb")
          ?.sha256;
    if (featherBack)
      object.geometry.setAttribute("_twin_mask", createTwinBoundaryMask(object.geometry));
    disposeMaterial(object);
    object.material = createTwinAnatomyMaterial(
      preset,
      appearance === "realistic"
        ? { regionMask: featherBack }
        : {
            ...(object.userData["twinSculptContours"] !== undefined &&
            object.geometry.getAttribute("_twin_sculpt_position")?.itemSize === 3
              ? {
                  contours: parseTwinSculptContours(object.userData["twinSculptContours"]),
                  ...(object.userData["twinSculptCompetition"]
                    ? {
                        competition: parseTwinSculptCompetition(
                          object.userData["twinSculptCompetition"],
                        ),
                      }
                    : {}),
                  contourFan: region === "chest" || region === "abs",
                }
              : {}),
            regionMask:
              object.userData["twinRegionMask"] === true &&
              object.geometry.getAttribute("_twin_mask")?.itemSize === 1,
            fibers:
              object.userData["twinFiberUV"] === true &&
              object.geometry.getAttribute("uv")?.itemSize === 2 &&
              region !== null &&
              isTwinBodyRegion(region),
          },
    );
    baseColorOf.set(object, preset.color);
    meshes.push(object);

    if (region && isTwinBodyRegion(region)) {
      regionOf.set(object, region);
      const existing = regionMeshes.get(region);
      if (existing) existing.push(object);
      else regionMeshes.set(region, [object]);
    }
  }

  if (regionMeshes.size === 0) {
    throw new Error("the human carries no region materials; region selection would be dead");
  }

  let disposed = false;
  return {
    provenance,
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
