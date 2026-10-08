import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { Mesh, Ray, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTwinPickingProfile } from "./twin-picking.profile";
import { createTwinCameraFrame } from "./twin-camera.framing";
import { twinNearSideReach } from "./twin-camera.navigation";

it("accepts the recorded visible Analysis calf without moving a single vertex", async () => {
  const bytes = new Uint8Array(await readFile("public/models/twin-selected-v1.glb"));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31",
  );
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, "");
  const meshes: Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  const digest = () =>
    meshes.map((mesh) => {
      const hash = createHash("sha256");
      for (const name of Object.keys(mesh.geometry.attributes).sort())
        hash.update(Buffer.from(mesh.geometry.getAttribute(name).array.buffer));
      const index = mesh.geometry.getIndex();
      if (index) hash.update(Buffer.from(index.array.buffer));
      return hash.digest("hex");
    });
  const before = digest();
  const frame = createTwinCameraFrame(scene);
  const started = performance.now();
  const profile = createTwinPickingProfile(scene);
  const profileMs = performance.now() - started;
  expect(profile).not.toBeNull();
  const camera = new Vector3(0, 0.5185216140747072, 2.4197801786959428);
  const direction = new Vector3(-0.030199411496845407, 0.025535432155555562, -0.9992176625990321);
  const ray = new Ray(camera, direction);
  const raycaster = new Raycaster(camera, direction);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  expect(hit).toBeDefined();
  if (!hit || !(hit.object instanceof Mesh)) throw new Error("Missing recorded calf surface");
  const material = Array.isArray(hit.object.material)
    ? hit.object.material[0]
    : hit.object.material;
  expect(material?.name).toBe("twin-region:legs");
  expect(hit.distance).toBeCloseTo(2.3717988329959385, 5);
  expect(hit.distance).toBeGreaterThan(twinNearSideReach(ray, camera, frame.target));
  const axis = new Vector3();
  expect(profile!.axisAt(hit.point, axis)).toBe(true);
  expect(hit.distance).toBeLessThan(twinNearSideReach(ray, camera, axis));
  expect(digest()).toEqual(before);
  console.log("Registered calf regression", {
    profileMs,
    hit: hit.distance,
    oldReach: twinNearSideReach(ray, camera, frame.target),
    newReach: twinNearSideReach(ray, camera, axis),
    axis: axis.toArray(),
  });
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  }
});
