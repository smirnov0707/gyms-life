import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Group, Mesh, PerspectiveCamera, Spherical, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createTwinCameraFrame } from "./twin-camera.framing";
import { createTwinBody } from "./twin-body.geometry";
import {
  TWIN_CAMERA,
  TWIN_FIELD_OF_VIEW,
  TWIN_FRAME,
  fittedTwinDistance,
} from "./twin-scene.model";

const assets = [
  "public/models/twin-anatomy-v1.glb",
  "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb",
  "tests/twin-browser/assets/twin-anatomy-continuous-candidate.glb",
  "tests/twin-browser/assets/twin-anatomy-pose-candidate.glb",
];

describe("actual-asset full-body camera framing", () => {
  it.each(assets)(
    "keeps every vertex inside the home frame: %s",
    async (asset) => {
      const bytes = new Uint8Array(await readFile(asset));
      const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, "");
      const originalScale = scene.scale.clone();
      const frame = createTwinCameraFrame(scene);
      const points: Vector3[] = [];
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const attribute = object.geometry.getAttribute("position");
        for (let i = 0; i < attribute.count; i++) {
          points.push(
            new Vector3().fromBufferAttribute(attribute, i).applyMatrix4(object.matrixWorld),
          );
        }
      });
      const projected = new Vector3();
      for (const aspect of [0.35, 0.65, 1.6]) {
        const distance = frame.fitDistance(aspect);
        const camera = new PerspectiveCamera(TWIN_FIELD_OF_VIEW, aspect, 0.01, 40);
        for (const pitch of [Math.PI / 2, TWIN_CAMERA.defaultPitch]) {
          for (let step = 0; step < 16; step++) {
            camera.position
              .copy(frame.target)
              .add(
                new Vector3().setFromSpherical(
                  new Spherical(distance, pitch, (step * Math.PI) / 8),
                ),
              );
            camera.lookAt(frame.target);
            camera.updateMatrixWorld(true);
            let edge = 0;
            for (const point of points) {
              projected.copy(point).project(camera);
              edge = Math.max(edge, Math.abs(projected.x), Math.abs(projected.y));
            }
            expect(edge).toBeLessThanOrEqual(1 / TWIN_FRAME.padding + 1e-6);
          }
        }
      }
      expect(scene.scale).toEqual(originalScale);
      expect(frame.fitDistance(Number.NaN)).toBe(frame.fitDistance(0.7));
      expect(frame.fitDistance(0)).toBe(frame.fitDistance(0.7));
      scene.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
    },
    30000,
  );

  it("rejects empty geometry rather than reporting a plausible frame", () => {
    expect(() => createTwinCameraFrame(new Group())).toThrow(/empty|invalid/);
  });
  it("reproduces the muscular candidate's clipping under the old fixed-height camera", async () => {
    const bytes = new Uint8Array(await readFile(assets[1]!));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer, "");
    scene.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(TWIN_FIELD_OF_VIEW, 0.65, 0.01, 40);
    camera.position.set(0, TWIN_FRAME.eyeHeight, fittedTwinDistance(0.65));
    camera.lookAt(0, TWIN_FRAME.eyeHeight, 0);
    camera.updateMatrixWorld(true);
    let top = -Infinity;
    const point = new Vector3();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
        top = Math.max(top, point.y);
      }
      object.geometry.dispose();
    });
    expect(top).toBeGreaterThan(1);
  });
});

// The generated fallback is taller than the shipped atlas. It needs its own
// frame too; using the atlas default clipped its head after an asset failure.
it("frames the actual generated fallback without clipping", () => {
  const model = createTwinBody();
  const frame = createTwinCameraFrame(model.body);
  const points: Vector3[] = [];
  model.body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++)
      points.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
  });
  for (const aspect of [0.35, 0.65, 1.6]) {
    const camera = new PerspectiveCamera(TWIN_FIELD_OF_VIEW, aspect, 0.01, 40);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      camera.position
        .copy(frame.target)
        .add(
          new Vector3().setFromSpherical(
            new Spherical(frame.fitDistance(aspect), TWIN_CAMERA.defaultPitch, yaw),
          ),
        );
      camera.lookAt(frame.target);
      camera.updateMatrixWorld(true);
      let edge = 0;
      for (const point of points) {
        const screen = point.clone().project(camera);
        edge = Math.max(edge, Math.abs(screen.x), Math.abs(screen.y));
      }
      expect(edge).toBeLessThanOrEqual(1 / TWIN_FRAME.padding + 1e-6);
    }
  }
  model.dispose();
});
