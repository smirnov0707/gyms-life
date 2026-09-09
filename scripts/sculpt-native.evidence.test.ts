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
