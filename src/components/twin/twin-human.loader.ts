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
/** Kit cut from the body's own surface at build time: shorts, and a top. */
const GARMENT_MATERIAL_PREFIX = "twin-";

/**
 * The body is a dark instrument, not a photograph of skin.
 *
 * It used to be skin-toned, on the principle that a human is tinted rather
 * than repainted — and that principle then fought every attempt to show data
 * on it, because a saturated colour laid over skin reads as clothing. The way
 * out is the one the design has always shown: make the body itself something
 * that is plainly not skin, and colour on it reads as a reading instead of as
 * a garment. Nothing is claimed by the change — this figure was never the
 * athlete's own body, and now it does not pretend to be.
 *
 * Slate blue-grey, not near-black. The first attempt at this went almost to
 * black with a metallic sheen, and the figure lost its own form: the arms and
 * legs disappeared into the page and only the lit muscle was left floating.
 * The body has to stay readable as a body where nothing is lit, so the colour
 * carries and the metalness is low enough not to swallow the fill light.
 */
const BODY = { color: 0x3a4a5e, roughness: 0.58, metalness: 0.06 };
const FABRIC = { color: 0x1a212b, roughness: 0.9, metalness: 0.04 };

/**
 * The skin, drawn as glass over the muscles.
 *
 * The figure is an anatomical atlas now: the muscles are real meshes sitting
 * inside a whole-body surface. Left opaque that surface hides every one of
 * them, which is how the first build came out — a plain grey body with the
 * whole point of the screen sealed underneath it. Depth writing is off so the
 * muscles behind it are not culled by it.
 */
const SKIN_GLASS = {
  color: 0x8fb4d6,
  roughness: 0.28,
  metalness: 0,
  transparent: true,
  opacity: 0.17,
  depthWrite: false,
};
/** Darker than the body, so the face reads as a face at a glance. */
const EYE = { color: 0x0a0d12, roughness: 0.28, metalness: 0 };

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
    const garment =
      sourceName.startsWith(GARMENT_MATERIAL_PREFIX) &&
      !sourceName.startsWith(REGION_MATERIAL_PREFIX);
    // The whole-body surface is the one mesh that is not a region: it carries
    // no reading, so it is the silhouette rather than a data surface.
    const isSkin = region === "neutral";
    const preset = garment ? FABRIC : sourceName === "Eyes" ? EYE : isSkin ? SKIN_GLASS : BODY;
    disposeMaterial(object);
    object.material = new MeshStandardMaterial(preset);
    // Drawn after the muscles, so the glass composites over them.
    if (isSkin) object.renderOrder = 2;
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
