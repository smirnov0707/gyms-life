import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = "tests/twin-browser/assets/twin-anatomy-muscular-candidate";
const bytes = readFileSync(`${base}.glb`);
const sha = createHash("sha256").update(bytes).digest("hex");
const topology = JSON.parse(readFileSync(`${base}.audit.json`, "utf8"));
const intersections = JSON.parse(readFileSync(`${base}.intersections.json`, "utf8"));

describe("native candidate evidence binding", () => {
  it("binds both reports to the exact browser fixture, not an older authoring output", () => {
    expect(topology.assetSha256).toBe(sha);
    expect(intersections.assetSha256).toBe(sha);
    expect(topology.bytes).toBe(bytes.length);
    expect(intersections.bytes).toBe(bytes.length);
    expect(topology.triangles).toBe(intersections.triangles);
    expect(intersections.completed).toBe(true);
    expect(intersections.passed).toBe(true);
  });
  it("binds the Khronos format check to the same exact model", () => {
    const format = JSON.parse(readFileSync(`${base}.validation.json`, "utf8"));
    expect(format.assetSha256).toBe(sha);
    expect(format.validationPassed).toBe(true);
    expect(format.khronos.issues.numErrors).toBe(0);
    expect(format.khronos.issues.numWarnings).toBe(0);
    expect(format.visualGatePassed).toBe(false);
    expect(format.productionIntegration).toBe(false);
  });
  it("does not turn numerical checks into visual or production approval", () => {
    expect(topology.visualGatePassed).toBe(false);
    expect(topology.productionIntegration).toBe(false);
    expect(intersections.scope).toContain("Shared-vertex pairs are excluded");
  });
});
