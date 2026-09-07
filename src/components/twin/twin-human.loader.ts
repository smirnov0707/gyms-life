import { Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isTwinBodyRegion, type TwinBodyRegion } from "./twin-scene.model";

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
 * An unlit muscle is still anatomy worth seeing.
 *
 * This is the colour a muscle carrying no reading has. It is a muted flesh
 * rather than the slate blue-grey it used to be: the figure spent a build
 * looking like a mannequin in a blue bag, because the body colour was chosen
 * to be plainly not skin and the translucent skin over it tinted everything
 * blue on top of that. Muscle-coloured is what the athlete recognises as a
 * body, and it says nothing about their state — every reading the app has is
 * one of the saturated data colours laid over this, and no region the app
 * cannot read ever gets one.
 */
const BODY = { color: 0xa8746a, roughness: 0.62, metalness: 0.02 };

/**
 * The skin, opaque, over the parts of the figure that have no muscle.
 *
 * The build drops every skin triangle with a muscle underneath it, so what
 * arrives here is the head, the hands, the feet, the shins and the pelvis —
 * and it is drawn as skin rather than as glass. The previous build kept the
 * whole surface and made it 17%-opacity glass so the muscles could be seen
 * through it, which left the whole figure looking as if it were sealed in
 * frosted plastic, with black hands and a black face.
 */
const SKIN = { color: 0xd7a98d, roughness: 0.78, metalness: 0 };

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
    // The kept skin is the one mesh that is not a region: it carries no
    // reading, so it is the silhouette rather than a data surface.
    const isSkin = region === "neutral";
    const preset = sourceName === "Eyes" ? EYE : isSkin ? SKIN : BODY;
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
