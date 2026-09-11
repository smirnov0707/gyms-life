import { Group, Mesh, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { TwinBodyRegion } from "./twin-scene.model";

const MAX_IDENTITY_SHELL_BYTES = 16 * 1024 * 1024;

export type TwinIdentityShellModel = {
  body: Group;
  meshes: Mesh[];
  regionMeshes: Map<TwinBodyRegion, Mesh[]>;
  regionOf: Map<Mesh, TwinBodyRegion>;
  baseColorOf: Map<Mesh, number>;
  dispose(): void;
};

function assertGlb(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_IDENTITY_SHELL_BYTES)
    throw new Error("PERSONALIZED_TWIN_IDENTITY_MODEL_SIZE_INVALID");
  const header = new DataView(bytes);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error("PERSONALIZED_TWIN_IDENTITY_MODEL_GLB_INVALID");
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
  else material.dispose();
}

function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    disposeMaterial(object.material);
  });
}

export async function loadTwinIdentityShell(
  url: string,
  signal?: AbortSignal,
): Promise<TwinIdentityShellModel> {
  signal?.throwIfAborted();
  const response = await fetch(url, { signal: signal ?? null, credentials: "omit" });
  if (!response.ok)
    throw new Error(`PERSONALIZED_TWIN_IDENTITY_MODEL_REQUEST_FAILED:${response.status}`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_IDENTITY_SHELL_BYTES)
    throw new Error("PERSONALIZED_TWIN_IDENTITY_MODEL_SIZE_INVALID");
  const bytes = await response.arrayBuffer();
  signal?.throwIfAborted();
  assertGlb(bytes);
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  signal?.throwIfAborted();
  const body = new Group();
  body.name = "personalized-twin-identity-shell";
  body.add(gltf.scene);
  const meshes: Mesh[] = [];
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  let disposed = false;
  return {
    body,
    meshes,
    regionMeshes: new Map(),
    regionOf: new Map(),
    baseColorOf: new Map(),
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObject(gltf.scene);
      body.clear();
    },
  };
}
