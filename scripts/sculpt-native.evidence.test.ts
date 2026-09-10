import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import {
  SCULPT_LOBES,
  sculptAt,
  protection,
  SCULPT_MAX_DISPLACEMENT_M,
  sculptSurfaceOwner,
  sculptRivalGuides,
  sampleLobe,
  SCULPT_MATERIAL_SUPPORT_SCALE,
} from "./authoring/sculpt-fields.mjs";

const base = "tests/twin-browser/assets/twin-anatomy-sculpt-candidate";
const bytes = readFileSync(base + ".glb"),
  sha = createHash("sha256").update(bytes).digest("hex");
const audit = JSON.parse(readFileSync(base + ".audit.json", "utf8"));
const intersections = JSON.parse(readFileSync(base + ".intersections.json", "utf8"));
describe("sculpt candidate evidence and bounded authoring", () => {
  it("binds the independent Khronos format report to the exact candidate", () => {
    const format = JSON.parse(readFileSync(base + ".validation.json", "utf8"));
    expect(format.assetSha256).toBe(sha);
    expect(format.validationPassed).toBe(true);
    expect(format.khronos.issues.numErrors).toBe(0);
    expect(format.khronos.issues.numWarnings).toBe(0);
    expect(format.visualGatePassed).toBe(false);
    expect(format.productionIntegration).toBe(false);
  });
  it("binds the authoring and exact-geometry reports to the served bytes", () => {
    expect(audit.assetSha256).toBe(sha);
    expect(intersections.assetSha256).toBe(sha);
    expect(audit.bytes).toBe(bytes.length);
    expect(intersections.bytes).toBe(bytes.length);
    expect(audit.triangles).toBe(intersections.triangles);
    expect(audit.maximumDisplacementMetres).toBeLessThanOrEqual(SCULPT_MAX_DISPLACEMENT_M);
    expect(audit.minimumTriangleNormalDot).toBeGreaterThan(0.5);
    expect(audit.connectedComponents).toBe(1);
    expect(audit.eulerCharacteristic).toBe(2);
    expect(intersections.passed).toBe(true);
    expect(audit.visualGatePassed).toBe(false);
    expect(audit.productionIntegration).toBe(false);
  });
  it("preserves the pinned original candidate and does not claim a personal model", () => {
    const original = readFileSync("tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb");
    expect(createHash("sha256").update(original).digest("hex")).toBe(audit.sourceSha256);
    expect(audit.sourceSha256).toBe(
      "5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158",
    );
    expect(intersections.scope).toContain("Shared-vertex pairs are excluded");
  });
  it("mirrors both the relief and masks while keeping a strict displacement bound", () => {
    for (const guide of SCULPT_LOBES)
      for (let i = 0; i < 11; i++) {
        const p = guide.centre.map(
          (v: number, k: number) => v + guide.radii[k] * Math.sin(i * (k + 1)),
        );
        const left = sculptAt(p, guide.region),
          right = sculptAt([-p[0], p[1], p[2]], guide.region);
        expect(left).toEqual(right);
        expect(left.lift).toBeGreaterThanOrEqual(0);
        expect(left.lift).toBeLessThanOrEqual(SCULPT_MAX_DISPLACEMENT_M);
        expect(left.mask).toBeGreaterThanOrEqual(0);
        expect(left.mask).toBeLessThanOrEqual(1);
      }
  });
  it.each([
    [0.1, 1.7, 0.1],
    [0.16, 0.03, 0.02],
    [0.35, 0.9, 0.05],
    [0, 0.98, 0.08],
  ])("protects native head, feet, hands and central pelvis at %j", (x, y, z) => {
    const p = [x, y, z];
    expect(protection(p)).toBe(0);
    expect(sculptAt(p, "neutral").lift).toBe(0);
  });
  it("keeps matched attributes, finite normals and eight canonical selectable regions", async () => {
    const doc = await new NodeIO().readBinary(bytes);
    const regions = new Set<string>();
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const region = prim.getMaterial()!.getName().replace("twin-region:", "");
        const p = prim.getAttribute("POSITION")!,
          n = prim.getAttribute("NORMAL")!;
        expect(prim.getAttribute("_TWIN_SCULPT_POSITION")!.getCount()).toBe(p.getCount());
        expect(prim.getAttribute("_TWIN_MASK")!.getCount()).toBe(p.getCount());
        const normals = n.getArray()!;
        for (let i = 0; i < normals.length; i += 3)
          expect(Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!)).toBeCloseTo(1, 5);
        if (region !== "neutral") regions.add(region);
      }
    expect([...regions].sort()).toEqual([
      "abs",
      "arms",
      "back",
      "chest",
      "core",
      "glutes",
      "legs",
      "shoulders",
    ]);
  });
  it("keeps graphical ownership symmetric and protects areas outside authored fields", () => {
    const regions = [
      "neutral",
      "shoulders",
      "chest",
      "core",
      "arms",
      "legs",
      "back",
      "glutes",
      "abs",
    ];
    for (const guide of SCULPT_LOBES)
      for (const region of regions) {
        const p = guide.centre;
        expect(sculptSurfaceOwner(p, region)).toBe(sculptSurfaceOwner([-p[0], p[1], p[2]], region));
      }
    for (const region of regions) {
      expect(sculptSurfaceOwner([0.1, 1.7, 0.1], region)).toBe(region);
      expect(sculptSurfaceOwner([2, 2, 2], region)).toBe(region);
    }
  });
  it("assigns every exported face to its actual graphical field owner", async () => {
    const doc = await new NodeIO().readBinary(bytes);
    const clipped: Record<string, number> = {};
    let checked = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const region = prim.getMaterial()!.getName().replace("twin-region:", "");
        const p = prim.getAttribute("_TWIN_SCULPT_POSITION")!.getArray()!;
        const indices = prim.getIndices()!.getArray()!;
        for (let i = 0; i < indices.length; i += 3) {
          const centre = [0, 1, 2].map(
            (k) =>
              (p[indices[i]! * 3 + k]! +
                p[indices[i + 1]! * 3 + k]! +
                p[indices[i + 2]! * 3 + k]!) /
              3,
          );
          const expected = sculptSurfaceOwner(centre, region);
          if (expected !== region)
            clipped[`${region}->${expected}`] = (clipped[`${region}->${expected}`] ?? 0) + 1;
          checked++;
        }
      }
    }
    expect(checked).toBe(audit.triangles);
    expect(clipped).toEqual({});
  });
  it("keeps all shared material seam vertices neutral with identical positions and normals", async () => {
    const doc = await new NodeIO().readBinary(bytes);
    const seams = new Map<string, { normal: number[]; mask: number; regions: Set<string> }>();
    let shared = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const region = prim.getMaterial()!.getName(),
          p = prim.getAttribute("POSITION")!.getArray()!,
          n = prim.getAttribute("NORMAL")!.getArray()!,
          mask = prim.getAttribute("_TWIN_MASK")!.getArray()!;
        for (let i = 0; i < p.length; i += 3) {
          const key = [p[i], p[i + 1], p[i + 2]].join(","),
            normal = [n[i]!, n[i + 1]!, n[i + 2]!],
            entry = seams.get(key);
          if (!entry) seams.set(key, { normal, mask: mask[i / 3]!, regions: new Set([region]) });
          else {
            expect(normal).toEqual(entry.normal);
            if (!entry.regions.has(region)) {
              shared++;
              expect(mask[i / 3]).toBe(0);
              expect(entry.mask).toBe(0);
            }
            entry.regions.add(region);
          }
        }
      }
    expect(shared).toBeGreaterThan(100);
    expect(audit.seamFeatherMetres).toBe(0.012);
  });
  it("does not cull a rival that could overlap a visible contour", () => {
    const strength = (position: number[], guide: (typeof SCULPT_LOBES)[number]) =>
      sampleLobe(position, {
        ...guide,
        radii: guide.radii.map((r: number) => r * SCULPT_MATERIAL_SUPPORT_SCALE),
      }).envelope;
    for (const own of SCULPT_LOBES) {
      const rivals = sculptRivalGuides(own.region);
      expect(rivals.length).toBeLessThanOrEqual(16);
      for (let i = 0; i < 71; i++) {
        const p = own.centre.map(
          (v: number, k: number) => v + own.radii[k] * 1.15 * Math.sin(i * (k + 1.7)),
        );
        if (strength(p, own) === 0) continue;
        const all = SCULPT_LOBES.filter((g) => g.region !== own.region).map((g) => strength(p, g));
        const culled = rivals.map((g) => strength(p, g));
        expect(Math.max(0, ...culled)).toBeCloseTo(Math.max(0, ...all), 12);
      }
    }
  });
  it("reproduces the same GLB from the pinned input without touching public assets", () => {
    const directory = mkdtempSync(join(tmpdir(), "gyms-sculpt-test-"));
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/authoring/sculpt-native-muscle.mjs",
          "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb",
          directory,
        ],
        { stdio: "pipe", timeout: 30000 },
      );
      const built = readFileSync(join(directory, "twin-anatomy-sculpt-candidate.glb"));
      expect(createHash("sha256").update(built).digest("hex")).toBe(sha);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);
});
