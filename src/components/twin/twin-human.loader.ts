import { Group, Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isTwinBodyRegion, type TwinBodyRegion } from "./twin-scene.model";
import { createTwinAnatomyMaterial } from "./twin-anatomy.material";
import { parseTwinSculptContours, parseTwinSculptCompetition } from "./twin-sculpt.contours";
import {
  MAX_TWIN_ASSET_BYTES,
  verifyTwinAsset,
  type TwinBodyProvenance,
} from "./twin-body.provenance";

/**
 * Loads the anatomical human and presents it with the same shape the scene
 * already consumes, so the renderer does not learn a second way to hold a body.
 *
 * The figure is a cadaveric anatomical atlas (see
 * public/models/twin-anatomy.manifest.json). It carries no skin texture: this
 * is a real human form, not a photograph of one, and nothing here pretends
 * otherwise.
 */

/** Region names ride on material names, since glTF primitives have none. */
const REGION_MATERIAL_PREFIX = "twin-region:";

/**
 * An unlit muscle, and the colour a region carrying no reading has.
 *
 * The figure is a dark instrument, not a photograph of skin. It was briefly
 * flesh-coloured, on the reasoning that a body should look like a body — and
 * that reasoning cost the screen everything it is for: on skin, a saturated
 * data colour reads as clothing, so every reading had to be muted until none
 * of them could be seen. A near-black body carries a lit muscle as a lit
 * muscle, which is how the design has always been drawn.
 *
 * Slate blue rather than near-black, and barely metallic. Both were darker and
 * half metal, which looks right in isolation and is wrong here: metalness eats
 * the diffuse term, so every part of the figure carrying no reading — the
 * head, the hands, the kneecaps, the sternum — rendered as a black hole in the
 * middle of the lit muscle around it. It has to read as unlit body, not as
 * missing body.
 */
const BODY = { color: 0x243746, roughness: 0.6, metalness: 0.12 };

/**
 * The skin, over the parts of the figure that have no muscle.
 *
 * The build drops every skin triangle with a muscle underneath it, so what
 * arrives here is the head, the hands, the feet, the shins and the pelvis. It
 * is the same instrument as the muscle, a shade lighter, so a hand reads as a
 * hand without turning the figure into a mannequin with a flesh-coloured head
 * on it.
 */
const SKIN = { color: 0x354956, roughness: 0.55, metalness: 0.1 };

/** Darker than the body, so the face reads as a face at a glance. */
const EYE = { color: 0x15222c, roughness: 0.4, metalness: 0.08 };

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

/**
 * The anatomical figure, which is one body rather than two.
 *
 * The old asset shipped a male and a female base mesh, and the profile chose
 * between them. This atlas is a single cadaveric body — there is no second
 * one to offer — so the variant is accepted and ignored rather than the call
 * sites all being changed to stop passing it.
 */
export function twinHumanUrl(_variant: TwinHumanVariant): string {
  return "/models/twin-anatomy-v1.glb";
}

/**
 * Resolves with the model, or rejects. Callers keep the surface they already
 * have on rejection — a missing or corrupt asset must never blank the scene.
 */
export async function loadTwinHuman(url: string, signal?: AbortSignal): Promise<TwinBodyModel> {
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
    return build(gltf.scene, provenance);
  } catch (error) {
    disposeObject(gltf.scene);
    throw error;
  }
}

function build(scene: Object3D, provenance: TwinBodyProvenance): TwinBodyModel {
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
    const isSkin = region === "neutral";
    const preset = sourceName === "Eyes" ? EYE : isSkin ? SKIN : BODY;
    disposeMaterial(object);
    object.material = createTwinAnatomyMaterial(preset, {
      ...(object.userData["twinSculptContours"] !== undefined &&
      object.geometry.getAttribute("_twin_sculpt_position")?.itemSize === 3
        ? {
            contours: parseTwinSculptContours(object.userData["twinSculptContours"]),
            ...(object.userData["twinSculptCompetition"]
              ? {
                  competition: parseTwinSculptCompetition(object.userData["twinSculptCompetition"]),
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
    });
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
