import { describe, expect, it } from "vitest";
import { ShaderLib } from "three";
import { parseTwinSculptContours } from "./twin-sculpt.contours";
import { createTwinAnatomyMaterial } from "./twin-anatomy.material";

const guide = { centre: [0.1, 1.4, 0.13], radii: [0.09, 0.1, 0.07], angle: 0.2 };
describe("bounded presentation contour contract", () => {
  it("accepts explicit finite three-dimensional guides", () => {
    expect(parseTwinSculptContours([guide])).toEqual([guide]);
  });
  it.each([
    null,
    [],
    Array.from({ length: 9 }, () => guide),
    [{ ...guide, radii: [0, 0.1, 0.2] }],
    [{ ...guide, centre: [Number.NaN, 1, 1] }],
    [{ ...guide, angle: Infinity }],
    [{ ...guide, radii: [1, 2] }],
  ])("rejects invalid or unbounded contour data: %j", (value) => {
    expect(() => parseTwinSculptContours(value)).toThrow();
  });
  it("compiles distinct plain, longitudinal and fan shader variants", () => {
    const contours = parseTwinSculptContours([guide]);
    const plain = createTwinAnatomyMaterial(
      { color: 0x354956 },
      { regionMask: true, fibers: true },
    );
    const sculpt = createTwinAnatomyMaterial(
      { color: 0x354956 },
      { regionMask: true, fibers: true, contours },
    );
    const fan = createTwinAnatomyMaterial(
      { color: 0x354956 },
      { regionMask: true, fibers: true, contours, contourFan: true },
    );
    expect(new Set([plain, sculpt, fan].map((m) => m.customProgramCacheKey())).size).toBe(3);
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    };
    Reflect.apply(sculpt.onBeforeCompile, sculpt, [shader, null]);
    expect(shader.vertexShader).toContain("_twin_sculpt_position");
    expect(shader.fragmentShader).toContain("uniform vec4 twinContourCentres[1]");
    expect(shader.fragmentShader).toContain("* twinContourMask");
    expect(shader.fragmentShader.indexOf("float twinContourPhase")).toBeLessThan(
      shader.fragmentShader.indexOf("float twinPhase"),
    );
    expect(shader.uniforms).toHaveProperty("twinContourRadii");
    for (const material of [plain, sculpt, fan]) material.dispose();
  });
  it("does not add sculpt attributes or uniforms to an existing asset", () => {
    const material = createTwinAnatomyMaterial({}, { regionMask: true, fibers: true });
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    };
    Reflect.apply(material.onBeforeCompile, material, [shader, null]);
    expect(shader.vertexShader).not.toContain("_twin_sculpt_position");
    expect(shader.fragmentShader).not.toContain("twinContourCentres");
    expect(shader.fragmentShader).toContain("vTwinFiberUv.y * 32.0");
    material.dispose();
  });
});
