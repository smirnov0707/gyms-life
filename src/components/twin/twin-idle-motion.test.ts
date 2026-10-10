import { readFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { createTwinBreathing } from "./twin-breathing";
import { createTwinIdleMotion, twinBlinkPhase, twinIdleOffset } from "./twin-idle-motion";

describe("natural resting movement", () => {
  it("anchors the feet and limits the pose while leaving blink pauses open", () => {
    for (const motion of ["stance", "head", "arms"] as const)
      for (const x of [-0.15, 0.15])
        expect(twinIdleOffset(new Vector3(x, 0.08, 0.05), motion).length()).toBe(0);
    expect(twinBlinkPhase(2710)).toBe(1);
    expect(twinBlinkPhase(2900)).toBe(0);
    expect(twinBlinkPhase(11000)).toBe(0);
    expect(twinBlinkPhase(NaN)).toBe(0);
  });
  it("moves the real surface and raycast together, closes lids over unchanged eyes, and resets", async () => {
    const doc = await new NodeIO().readBinary(
      new Uint8Array(await readFile("public/models/twin-natural-skin-v1.glb")),
    );
    const group = new Group(),
      meshes: Mesh[] = [];
    for (const source of doc.getRoot().listMeshes())
      for (const primitive of source.listPrimitives()) {
        const geometry = new BufferGeometry();
        for (const [name, semantic] of [
          ["position", "POSITION"],
          ["normal", "NORMAL"],
        ])
          geometry.setAttribute(
            name!,
            new Float32BufferAttribute(primitive.getAttribute(semantic!)!.getArray()!, 3),
          );
        geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
        const mesh = new Mesh(geometry, new MeshStandardMaterial());
        mesh.name = primitive.getMaterial()!.getName();
        mesh.userData["twinNativeBlink"] = mesh.name === "twin-region:neutral";
        meshes.push(mesh);
        group.add(mesh);
      }
    const bases = meshes.map((mesh) => Array.from(mesh.geometry.getAttribute("position").array));
    const breathing = createTwinBreathing(group),
      idle = createTwinIdleMotion(group);
    const eye = meshes.find((mesh) => mesh.name === "Eyes")!;
    const neutral = meshes.find((mesh) => mesh.userData["twinNativeBlink"])!;
    // Isolate blink to prove the actual lid surface occludes the eye at its centre.
    const ray = new Raycaster(new Vector3(0.032, 1.736, 1), new Vector3(0, 0, -1));
    expect(ray.intersectObjects([eye, neutral], false)[0]!.object).toBe(eye);
    neutral.morphTargetInfluences![4] = 1;
    expect(ray.intersectObjects([eye, neutral], false)[0]!.object).toBe(neutral);
    expect(Array.from(eye.geometry.morphAttributes.position![4]!.array).every((x) => x === 0)).toBe(
      true,
    );
    idle.setTime(3200, true);
    breathing.setPhase(0.8);
    const chest = meshes.find((mesh) => mesh.name === "twin-region:chest")!;
    const hit = new Raycaster(new Vector3(0.08, 1.4, 1), new Vector3(0, 0, -1)).intersectObject(
      chest,
    )[0]!;
    expect(hit).toBeDefined();
    const triangle = hit.face!;
    const points = [triangle.a, triangle.b, triangle.c].map((index) =>
      chest.getVertexPosition(index, new Vector3()),
    );
    const centre = points.reduce((a, b) => a.add(b), new Vector3()).divideScalar(3);
    const movedHit = new Raycaster(
      centre.clone().add(new Vector3(0, 0, 1)),
      new Vector3(0, 0, -1),
    ).intersectObject(chest)[0]!;
    expect(movedHit.point.distanceTo(centre)).toBeLessThan(1e-5);
    for (const [i, mesh] of meshes.entries()) {
      expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(bases[i]);
      const position = mesh.geometry.getAttribute("position");
      for (let vertex = 0; vertex < position.count; vertex++) {
        const base = new Vector3().fromBufferAttribute(position, vertex);
        const moved = mesh.getVertexPosition(vertex, new Vector3());
        expect(moved.distanceTo(base)).toBeLessThan(0.055);
        if (base.y < 0.14) expect(moved.distanceTo(base)).toBeLessThan(1e-8);
        expect(mesh.geometry.boundingBox!.containsPoint(moved)).toBe(true);
      }
    }
    idle.setTime(2710, false);
    breathing.setPhase(0);
    for (const mesh of meshes) {
      expect(mesh.morphTargetInfluences!.every((value) => value === 0)).toBe(true);
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
  });
});
