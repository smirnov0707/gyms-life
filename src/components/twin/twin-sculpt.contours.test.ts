import { describe, expect, it } from "vitest";
import { ShaderLib } from "three";
import { parseTwinSculptContours, parseTwinSculptCompetition } from "./twin-sculpt.contours";
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

describe("presentation profile and contour competition limits", () => {
  it("defaults an older contour to the elliptical shader exponent", () => {
    const material = createTwinAnatomyMaterial(
      {},
      { regionMask: true, contours: parseTwinSculptContours([guide]) },
    );
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    };
    Reflect.apply(material.onBeforeCompile, material, [shader, null]);
    expect(shader.uniforms).toHaveProperty("twinContourPowers.value", [2]);
    material.dispose();
  });
  it.each([1, 4.1, Number.NaN, Infinity])(
    "rejects out-of-bounds superellipse power %s",
    (power) => {
      expect(() => parseTwinSculptContours([{ ...guide, power }])).toThrow();
    },
  );
  it("preserves an explicit rounded profile and bounded neighbor competition", () => {
    const contours = parseTwinSculptContours([{ ...guide, power: 3.5 }]);
    const competition = parseTwinSculptCompetition({ supportScale: 1.2, rivals: [guide] });
    const material = createTwinAnatomyMaterial({}, { regionMask: true, contours, competition });
    const independent = createTwinAnatomyMaterial({}, { regionMask: true, contours });
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    };
    Reflect.apply(material.onBeforeCompile, material, [shader, null]);
    expect(shader.uniforms).toHaveProperty("twinContourPowers.value", [3.5]);
    expect(shader.uniforms).toHaveProperty("twinRivalPowers.value", [2]);
    expect(shader.uniforms).toHaveProperty("twinSupportScale.value", 1.2);
    expect(shader.fragmentShader).toContain("twinOwnSupport - twinRivalSupport");
    expect(material.customProgramCacheKey()).not.toBe(independent.customProgramCacheKey());
    material.dispose();
    independent.dispose();
  });
  it.each([
    { supportScale: 0, rivals: [] },
    { supportScale: 2, rivals: [] },
    { supportScale: 1.2, rivals: Array.from({ length: 17 }, () => guide) },
    { supportScale: 1.2, rivals: [{ ...guide, radii: [0, 1, 1] }] },
  ])("rejects invalid rival metadata %j", (value) => {
    expect(() => parseTwinSculptCompetition(value)).toThrow();
  });
});
