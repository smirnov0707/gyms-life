import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTwinBreathing, twinBreathOffset } from "./twin-breathing";

describe("decorative breathing", () => {
  it("keeps head, hands and feet fixed and limits the chest to millimetres", () => {
    const box = new Box3(new Vector3(-0.38, 0, -0.1), new Vector3(0.38, 1.85, 0.22));
    for (const point of [
      [0, 1.7, 0.1],
      [0.31, 1, 0.05],
      [0.1, 0.05, 0.1],
    ])
      expect(twinBreathOffset(new Vector3(...point), box).length()).toBe(0);
    const left = twinBreathOffset(new Vector3(-0.08, 1.4, 0.14), box);
    const right = twinBreathOffset(new Vector3(0.08, 1.4, 0.14), box);
    expect(left.x).toBe(-right.x);
    expect(left.z).toBe(right.z);
    expect(left.length()).toBeGreaterThan(0.002);
    expect(left.length()).toBeLessThan(0.003);
  });
  it("animates the actual registered mesh and raycast while preserving base coordinates", async () => {
    const bytes = new Uint8Array(await readFile("public/models/twin-natural-v1.glb"));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, "");
    const meshes: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    const base = meshes.map((mesh) => Array.from(mesh.geometry.getAttribute("position").array));
    const breathing = createTwinBreathing(scene);
    const ray = new Raycaster(new Vector3(0.08, 1.4, 2), new Vector3(0, 0, -1));
    const resting = ray.intersectObjects(meshes, false)[0]!;
    expect(resting).toBeDefined();
    breathing.setPhase(1);
    const inhaled = ray.intersectObjects(meshes, false)[0]!;
    expect(inhaled.object).toBe(resting.object);
    expect(resting.distance - inhaled.distance).toBeGreaterThan(0.002);
    expect(resting.distance - inhaled.distance).toBeLessThan(0.003);
    for (const [i, mesh] of meshes.entries()) {
      expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(base[i]);
      const offsets = mesh.geometry.morphAttributes.position![0]!;
      for (let j = 0; j < offsets.count; j++) {
        const delta = new Vector3().fromBufferAttribute(offsets, j);
        expect(delta.length()).toBeLessThan(0.0032);
      }
    }
    breathing.setPhase(0);
    expect(ray.intersectObjects(meshes, false)[0]!.distance).toBe(resting.distance);
    meshes.forEach((mesh) => {
      mesh.geometry.dispose();
    });
  });
});
