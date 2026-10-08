import { describe, expect, it } from "vitest";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Ray,
  Vector3,
} from "three";
import { createTwinPickingProfile } from "./twin-picking.profile";
import { twinNearSideReach } from "./twin-camera.navigation";

function body(indexed = true) {
  const root = new Group();
  for (const { size, centre } of [
    { size: new Vector3(0.3, 0.7, 0.24), centre: new Vector3(0, 0.4, -0.12) },
    { size: new Vector3(0.55, 0.75, 0.32), centre: new Vector3(0, 1.2, 0.1) },
  ]) {
    const source = new BoxGeometry(size.x, size.y, size.z);
    const mesh = new Mesh(indexed ? source : source.toNonIndexed());
    if (!indexed) source.dispose();
    mesh.position.copy(centre);
    root.add(mesh);
  }
  return root;
}
function dispose(root: Group) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
function requireProfile(root: Group) {
  const profile = createTwinPickingProfile(root);
  expect(profile).not.toBeNull();
  if (!profile) throw new Error("Test body must have a valid picking profile");
  return profile;
}

describe("height-aware graphical picking axis", () => {
  it.each([true, false])("uses actual triangle sections, indexed=%s", (indexed) => {
    const root = body(indexed),
      profile = requireProfile(root),
      out = new Vector3();
    expect(profile.axisAt(new Vector3(0, 0.5, 0), out)).toBe(true);
    expect(out.z).toBeCloseTo(-0.12);
    expect(out.x).toBeCloseTo(0);
    expect(profile.axisAt(new Vector3(0, 1.2, 0), out)).toBe(true);
    expect(out.z).toBeCloseTo(0.1);
    dispose(root);
  });
  it("accepts a visible calf that the whole-body centre incorrectly rejects", () => {
    const root = body(),
      profile = requireProfile(root);
    const front = new Vector3(0, 0.5, 0),
      camera = new Vector3(0, 0.5, 3);
    const ray = new Ray(camera, front.clone().sub(camera).normalize());
    const home = new Box3().setFromObject(root).getCenter(new Vector3());
    expect(camera.distanceTo(front)).toBeGreaterThan(twinNearSideReach(ray, camera, home));
    const axis = new Vector3();
    expect(profile.axisAt(front, axis)).toBe(true);
    expect(camera.distanceTo(front)).toBeLessThan(twinNearSideReach(ray, camera, axis));
    const far = new Vector3(0, 0.5, -0.24);
    expect(camera.distanceTo(far)).toBeGreaterThan(twinNearSideReach(ray, camera, axis));
    dispose(root);
  });
  it("still rejects the far back through a front torso gap", () => {
    const root = body(),
      profile = requireProfile(root),
      axis = new Vector3();
    const camera = new Vector3(0, 1.2, 3),
      front = new Vector3(0, 1.2, 0.26),
      back = new Vector3(0, 1.2, -0.06);
    const ray = new Ray(camera, new Vector3(0, 0, -1));
    profile.axisAt(front, axis);
    expect(camera.distanceTo(front)).toBeLessThan(twinNearSideReach(ray, camera, axis));
    expect(camera.distanceTo(back)).toBeGreaterThan(twinNearSideReach(ray, camera, axis));
    dispose(root);
  });
  it.each([0, Math.PI / 2, Math.PI, Math.PI * 1.5])(
    "keeps near/far separation at yaw %s",
    (yaw) => {
      const root = body(),
        profile = requireProfile(root),
        axis = new Vector3();
      const centre = new Vector3(0, 0.5, -0.12);
      const direction = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const camera = centre.clone().addScaledVector(direction, 3);
      const near = centre.clone().addScaledVector(direction, 0.1),
        far = centre.clone().addScaledVector(direction, -0.1);
      const ray = new Ray(camera, direction.clone().negate());
      profile.axisAt(near, axis);
      expect(camera.distanceTo(near)).toBeLessThan(twinNearSideReach(ray, camera, axis));
      expect(camera.distanceTo(far)).toBeGreaterThan(twinNearSideReach(ray, camera, axis));
      dispose(root);
    },
  );
  it("keeps the calf selectable when the camera is tilted", () => {
    const root = body(),
      profile = requireProfile(root),
      axis = new Vector3();
    const camera = new Vector3(0, 1.4, 3),
      front = new Vector3(0, 0.5, 0);
    const ray = new Ray(camera, front.clone().sub(camera).normalize());
    profile.axisAt(front, axis);
    expect(camera.distanceTo(front)).toBeLessThan(twinNearSideReach(ray, camera, axis));
    dispose(root);
  });
  it("handles parent translation, scale and later body sway without rebuilding", () => {
    const root = body(),
      parent = new Group();
    parent.add(root);
    parent.position.set(2, 3, -4);
    parent.scale.set(0.5, 2, 1.4);
    const profile = requireProfile(root),
      axis = new Vector3();
    root.rotation.z = 0.003;
    parent.rotation.y = 0.7;
    parent.updateMatrixWorld(true);
    const hit = root.localToWorld(new Vector3(0.03, 0.5, 0));
    const expected = root.localToWorld(new Vector3(0, 0.5, -0.12));
    expect(profile.axisAt(hit, axis)).toBe(true);
    expect(axis.distanceTo(expected)).toBeLessThan(1e-6);
    dispose(root);
  });
  it("does not mutate triangle, UV, normal or index buffers", () => {
    const root = body();
    const meshes = root.children.filter((object): object is Mesh => object instanceof Mesh);
    const before = meshes.map((mesh) => JSON.stringify(mesh.geometry.toJSON()));
    const profile = requireProfile(root);
    profile.axisAt(new Vector3(0, 0.5, 0), new Vector3());
    expect(meshes.map((mesh) => JSON.stringify(mesh.geometry.toJSON()))).toEqual(before);
    dispose(root);
  });
  it("returns no profile for empty, flat or invalid geometry", () => {
    expect(createTwinPickingProfile(new Group())).toBeNull();
    const flat = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
    flat.add(new Mesh(geometry));
    expect(createTwinPickingProfile(flat)).toBeNull();
    geometry.setAttribute("position", new Float32BufferAttribute([NaN, 0, 0, 1, 1, 0, 0, 0, 1], 3));
    expect(createTwinPickingProfile(flat)).toBeNull();
    dispose(flat);
  });
  it("rejects nonfinite hits without changing caller output", () => {
    const root = body(),
      profile = requireProfile(root),
      out = new Vector3(1, 2, 3);
    expect(profile.axisAt(new Vector3(NaN, 0, 0), out)).toBe(false);
    expect(out.toArray()).toEqual([1, 2, 3]);
    dispose(root);
  });
  it("fails closed after a later singular body transform", () => {
    const root = body(),
      profile = requireProfile(root),
      out = new Vector3(1, 2, 3);
    root.scale.y = 0;
    expect(profile.axisAt(new Vector3(0, 0.5, 0), out)).toBe(false);
    expect(out.toArray()).toEqual([1, 2, 3]);
    dispose(root);
  });
  it("handles hits at both profile endpoints without missing array values", () => {
    const root = body(),
      profile = requireProfile(root),
      out = new Vector3();
    expect(profile.axisAt(new Vector3(0, -10, 0), out)).toBe(true);
    expect(out.toArray().every(Number.isFinite)).toBe(true);
    expect(profile.axisAt(new Vector3(0, 10, 0), out)).toBe(true);
    expect(out.toArray().every(Number.isFinite)).toBe(true);
    dispose(root);
  });
});
