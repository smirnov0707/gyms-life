import { describe, expect, it } from "vitest";
import { Mesh, Raycaster, Vector3 } from "three";
import { createTwinBody } from "./twin-body.geometry";
import { TWIN_BODY_REGIONS } from "./twin-scene.model";
import surface from "./twin-body.surface.json";

const faces = Object.values(surface.groups).flat();

describe("continuous generic Twin surface", () => {
  it("retains exactly the supported groups and a neutral non-measured surface", () => {
    expect(Object.keys(surface.groups).sort()).toEqual(["neutral", ...TWIN_BODY_REGIONS].sort());
    expect(surface.version).toBe("generic-human-surface-1");
    expect(surface.positions.length % 3).toBe(0);
    expect(surface.positions.every(Number.isFinite)).toBe(true);
    const count = surface.positions.length / 3;
    expect(count).toBeGreaterThan(1000);
    expect(count).toBeLessThanOrEqual(15000);
    expect(faces.length / 3).toBeLessThanOrEqual(24000);
    expect(faces.every((index) => Number.isInteger(index) && index >= 0 && index < count)).toBe(true);
    for (const indices of Object.values(surface.groups)) {
      expect(indices.length).toBeGreaterThan(0);
      expect(indices.length % 3).toBe(0);
    }
  });

  it("forms one closed connected surface with consistent winding, not disconnected joints", () => {
    const edges = new Map<string, { count: number; winding: number }>();
    const neighbours = new Map<number, Set<number>>();
    for (let i = 0; i < faces.length; i += 3) {
      const triangle = faces.slice(i, i + 3);
      expect(new Set(triangle).size).toBe(3);
      for (let j = 0; j < 3; j++) {
        const a = triangle[j]!;
        const b = triangle[(j + 1) % 3]!;
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const existing = edges.get(key) ?? { count: 0, winding: 0 };
        existing.count++;
        existing.winding += a < b ? 1 : -1;
        edges.set(key, existing);
        if (!neighbours.has(a)) neighbours.set(a, new Set());
        neighbours.get(a)!.add(b);
      }
    }
    expect([...edges.values()].every((edge) => edge.count === 2 && edge.winding === 0)).toBe(true);
    const visited = new Set<number>();
    const queue = [faces[0]!];
    while (queue.length) {
      const vertex = queue.pop()!;
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      for (const other of neighbours.get(vertex) ?? []) if (!visited.has(other)) queue.push(other);
    }
    expect(visited.size).toBe(surface.positions.length / 3);
  });

  it("shares complete-surface normals across all display regions", () => {
    const model = createTwinBody();
    try {
      expect(model.meshes).toHaveLength(9);
      const first = model.meshes[0]!;
      for (const mesh of model.meshes) {
        expect(mesh.geometry.getAttribute("position")).toBe(first.geometry.getAttribute("position"));
        expect(mesh.geometry.getAttribute("normal")).toBe(first.geometry.getAttribute("normal"));
      }
      const normal = first.geometry.getAttribute("normal");
      for (let i = 0; i < normal.count; i++) {
        const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
        expect(length).toBeGreaterThan(0.99);
        expect(length).toBeLessThan(1.01);
      }
      first.geometry.computeBoundingBox();
      const bounds = first.geometry.boundingBox!;
      expect(bounds.max.y).toBeLessThan(1.90);
      expect(bounds.min.y).toBeGreaterThan(0);
      expect(bounds.max.x - bounds.min.x).toBeLessThan(0.90);
    } finally {
      model.dispose();
      model.dispose();
      expect(model.body.children).toHaveLength(0);
      expect(model.regionOf.size).toBe(0);
    }
  });

  it.each([
    ["chest", 0.08, 1.36, 2, 0, 0, -1],
    ["back", 0.08, 1.32, -2, 0, 0, 1],
    ["arms", 0.28, 1.24, 2, 0, 0, -1],
    ["legs", 0.10, 0.75, 2, 0, 0, -1],
    ["glutes", 0.08, 0.95, -2, 0, 0, 1],
    ["abs", 0, 1.15, 2, 0, 0, -1],
    ["shoulders", 2, 1.43, 0, -1, 0, 0],
    ["core", 2, 1.13, 0, -1, 0, 0],
  ] as const)("raycasts the visible %s region", (expected, x, y, z, dx, dy, dz) => {
    const model = createTwinBody();
    try {
      model.body.updateMatrixWorld(true);
      const ray = new Raycaster(new Vector3(x, y, z), new Vector3(dx, dy, dz));
      const first = ray.intersectObjects(model.meshes, false)[0];
      expect(first?.object).toBeInstanceOf(Mesh);
      expect(first?.object instanceof Mesh ? model.regionOf.get(first.object) : null).toBe(expected);
    } finally {
      model.dispose();
    }
  });
});
